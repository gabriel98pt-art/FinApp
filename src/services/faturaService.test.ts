// Operações de fatura, com o firebase/database trocado por um duplo em
// memória — mesmo padrão de parcelasService.test.ts e syncService.test.ts.
//
// O que estes testes protegem é a atomicidade e o dinheiro invisível. Pagar
// uma fatura não é gravar uma linha: é gravar o lançamento do pagamento, a
// lista de pagamentos do cartão e — quando o pagamento QUITA — o lançamento
// mensal de cada parcela em débito automático daquele ciclo. Se essa última
// parte se perdesse, o dinheiro da parcela saía da conta do utilizador sem
// aparecer em despesa nenhuma (é o "bug 2 da seção 4.1" citado no serviço), e
// é o tipo de divergência que só se nota meses depois ao fechar as contas.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Parcela, PagamentoFatura } from "../types";

let dados: Record<string, unknown> = {};
/** Cada chamada a update(), para provar que tudo vai na MESMA escrita. */
let updates: { caminho: string; mudancas: Record<string, unknown> }[] = [];
let contador = 0;

vi.mock("./firebase", () => ({ db: {} }));

const snapshot = vi.fn();
vi.mock("../stores/historicoStore", () => ({ snapshotHistorico: () => snapshot() }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  push: (r: { caminho: string }) => {
    const key = `k${++contador}`;
    return { caminho: `${r.caminho}/${key}`, key };
  },
  set: async (r: { caminho: string }, valor: unknown) => {
    dados[r.caminho] = valor;
  },
  remove: async (r: { caminho: string }) => {
    delete dados[r.caminho];
  },
  update: async (r: { caminho: string }, mudancas: Record<string, unknown>) => {
    updates.push({ caminho: r.caminho, mudancas });
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null) delete dados[`${r.caminho}/${k}`];
      else dados[`${r.caminho}/${k}`] = v;
    }
  },
  onValue: () => () => {},
  get: async () => ({ val: () => null }),
}));

const s = await import("./faturaService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5`;

/** A fatura de agosto cobre os gastos de JULHO (cicloDaFatura = mês-1). */
const MES_FATURA = "2026-08";
const CICLO = "2026-07";

/** 300,00 € em 3× a começar em julho — a 1.ª cai dentro do ciclo da fatura. */
const parcelaAuto: Parcela = {
  id: "p1",
  descricao: "Portátil",
  total: 30000,
  numParcelas: 3,
  primeiroMes: CICLO,
  categoria: "Tecnologia",
  cartao: "Cartão Gold",
  autoDebit: true,
  pagoPorMes: {},
};

function ctx(over: Partial<Parameters<typeof s.pagarFatura>[1]> = {}) {
  return {
    cartao: "Cartão Gold",
    mes: MES_FATURA,
    valor: 10000,
    de: "Conta à ordem",
    pagamentosAtuais: [] as PagamentoFatura[],
    devido: 10000,
    parcelas: [] as Parcela[],
    ...over,
  };
}

/** Todas as chaves gravadas que são lançamentos de despesa. */
const lancamentos = () =>
  Object.entries(updates[0]?.mudancas ?? {}).filter(([k]) => k.startsWith("despesasCorrentes/"));

beforeEach(() => {
  dados = {};
  updates = [];
  contador = 0;
  snapshot.mockClear();
});

describe("pagarFatura", () => {
  test("grava pagamento e lançamento numa única escrita atómica", async () => {
    await s.pagarFatura(UID, ctx());

    // Uma só chamada a update(), na raiz: se o lançamento e a lista de
    // pagamentos fossem escritas separadas, uma podia falhar sem a outra e a
    // fatura ficava paga sem despesa (ou o contrário).
    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(RAIZ);
    expect(lancamentos()).toHaveLength(1);
    expect(updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`]).toBeDefined();
  });

  test("o lançamento do pagamento tem origem 'fat' e aponta para a fatura", async () => {
    await s.pagarFatura(UID, ctx());

    const [, lanc] = lancamentos()[0];
    expect(lanc).toMatchObject({
      descricao: "Cartão de Crédito Cartão Gold",
      valor: 10000,
      // 'fat' é o que mantém este lançamento FORA dos totais de despesa: a
      // compra original já contou, contá-lo outra vez duplicaria o gasto.
      origem: "fat",
      fatCartao: "Cartão Gold",
      fatMes: MES_FATURA,
      contaCartao: "Conta à ordem",
    });
  });

  test("o id do pagamento é o mesmo id do lançamento criado", async () => {
    await s.pagarFatura(UID, ctx());

    const [chave] = lancamentos()[0];
    const id = chave.replace("despesasCorrentes/", "");
    const pagas = updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`] as {
      pagamentos: PagamentoFatura[];
    };
    // É por este id que removerPagamentoFatura apaga o lançamento certo. Se os
    // dois se separassem, remover um pagamento deixava a despesa órfã.
    expect(pagas.pagamentos[0].id).toBe(id);
  });

  test("pagamento parcial NÃO quita as parcelas em débito automático", async () => {
    // Devido 200,00, pago 100,00 — sobra metade, a fatura continua aberta.
    await s.pagarFatura(UID, ctx({ valor: 10000, devido: 20000, parcelas: [parcelaAuto] }));

    expect(updates[0].mudancas[`parcelas/p1/pagoPorMes/${CICLO}`]).toBeUndefined();
    expect(lancamentos()).toHaveLength(1); // só o do pagamento
  });

  test("pagamento que quita marca a parcela autoDebit do ciclo e cria o lançamento dela", async () => {
    await s.pagarFatura(UID, ctx({ valor: 10000, devido: 10000, parcelas: [parcelaAuto] }));

    expect(updates[0].mudancas[`parcelas/p1/pagoPorMes/${CICLO}`]).toBe("fatura");

    // Dois lançamentos na MESMA escrita: o pagamento da fatura e a parcela.
    // Sem o segundo, os 100,00 da parcela saíam da conta sem aparecer em
    // despesa nenhuma.
    expect(lancamentos()).toHaveLength(2);
    const parcelaLanc = lancamentos()
      .map(([, v]) => v)
      .find((l) => (l as { origem: string }).origem === "parc");
    expect(parcelaLanc).toMatchObject({
      descricao: "Portátil",
      valor: 10000, // 300,00 / 3
      origem: "parc",
      parcelaId: "p1",
      parcelaMes: CICLO,
      nota: "1ª de 3 — via fatura",
    });
  });

  test("a parcela arrastada fica sem contaCartao — o dinheiro saiu pela fatura", async () => {
    await s.pagarFatura(UID, ctx({ parcelas: [parcelaAuto] }));

    const parcelaLanc = lancamentos()
      .map(([, v]) => v as Record<string, unknown>)
      .find((l) => l.origem === "parc")!;
    // Com contaCartao preenchido, a parcela entrava OUTRA VEZ na fatura
    // seguinte do mesmo cartão — o pagamento gerava dívida nova.
    expect(parcelaLanc.contaCartao).toBeUndefined();
  });

  test("quitar não toca em parcela de outro cartão, sem autoDebit, ou fora do ciclo", async () => {
    const outroCartao: Parcela = { ...parcelaAuto, id: "p2", cartao: "Cartão Azul" };
    const manual: Parcela = { ...parcelaAuto, id: "p3", autoDebit: undefined };
    // Começa depois do ciclo coberto por esta fatura.
    const foraDoCiclo: Parcela = { ...parcelaAuto, id: "p4", primeiroMes: "2026-11" };
    const jaPaga: Parcela = { ...parcelaAuto, id: "p5", pagoPorMes: { [CICLO]: true } };

    await s.pagarFatura(
      UID,
      ctx({ parcelas: [outroCartao, manual, foraDoCiclo, jaPaga, parcelaAuto] }),
    );

    for (const id of ["p2", "p3", "p4", "p5"]) {
      expect(updates[0].mudancas[`parcelas/${id}/pagoPorMes/${CICLO}`]).toBeUndefined();
    }
    expect(updates[0].mudancas[`parcelas/p1/pagoPorMes/${CICLO}`]).toBe("fatura");
  });

  test("a data do pagamento vale também para as parcelas que ele arrasta", async () => {
    // Acerto de um pagamento passado: saíram todos no mesmo movimento de
    // dinheiro, portanto têm de partilhar a data — senão o pagamento aparece
    // em julho e a parcela que ele quitou aparece em agosto.
    await s.pagarFatura(UID, ctx({ data: "2026-07-31", parcelas: [parcelaAuto] }));

    for (const [, lanc] of lancamentos()) {
      expect((lanc as { data: string }).data).toBe("2026-07-31");
    }
  });

  test("soma os pagamentos anteriores para decidir se quitou", async () => {
    const anterior: PagamentoFatura = {
      id: "antigo",
      data: "2026-08-01",
      valor: 6000,
      de: "Conta à ordem",
    };
    // Devido 100,00; já tinham sido pagos 60,00; agora pagam-se 40,00 — fecha.
    await s.pagarFatura(
      UID,
      ctx({ valor: 4000, devido: 10000, pagamentosAtuais: [anterior], parcelas: [parcelaAuto] }),
    );

    expect(updates[0].mudancas[`parcelas/p1/pagoPorMes/${CICLO}`]).toBe("fatura");
    const pagas = updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`] as {
      pagamentos: PagamentoFatura[];
    };
    expect(pagas.pagamentos).toHaveLength(2);
  });

  test("guarda um ponto no histórico antes de escrever", async () => {
    await s.pagarFatura(UID, ctx());
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("removerPagamentoFatura", () => {
  const pagamento: PagamentoFatura = {
    id: "dc1",
    data: "2026-08-05",
    valor: 5000,
    de: "Conta à ordem",
  };

  test("apaga o lançamento e mantém os outros pagamentos", async () => {
    const outro: PagamentoFatura = { ...pagamento, id: "dc2", valor: 3000 };

    await s.removerPagamentoFatura(UID, "Cartão Gold", MES_FATURA, pagamento, [pagamento, outro]);

    expect(updates).toHaveLength(1);
    expect(updates[0].mudancas["despesasCorrentes/dc1"]).toBeNull();
    expect(updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`]).toEqual({
      pagamentos: [outro],
    });
  });

  test("removendo o último pagamento, a fatura volta a não ter registo nenhum", async () => {
    await s.removerPagamentoFatura(UID, "Cartão Gold", MES_FATURA, pagamento, [pagamento]);

    // null e não `{ pagamentos: [] }`: uma lista vazia deixava a fatura marcada
    // como "tem registo de pagamento" para sempre.
    expect(updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`]).toBeNull();
  });
});

describe("reabrirFatura", () => {
  test("apaga o registo da fatura e todos os lançamentos de pagamento", async () => {
    const pagamentos: PagamentoFatura[] = [
      { id: "dc1", data: "2026-08-05", valor: 5000, de: "Conta à ordem" },
      { id: "dc2", data: "2026-08-09", valor: 5000, de: "Conta à ordem" },
    ];

    await s.reabrirFatura(UID, "Cartão Gold", MES_FATURA, pagamentos);

    expect(updates).toHaveLength(1);
    expect(updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`]).toBeNull();
    expect(updates[0].mudancas["despesasCorrentes/dc1"]).toBeNull();
    expect(updates[0].mudancas["despesasCorrentes/dc2"]).toBeNull();
  });

  test("reabrir sem pagamentos nenhuns não rebenta", async () => {
    await s.reabrirFatura(UID, "Cartão Gold", MES_FATURA, []);
    expect(updates[0].mudancas[`cfg/faturasPagas/Cartão Gold/${MES_FATURA}`]).toBeNull();
  });
});
