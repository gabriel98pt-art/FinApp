// Operações de parcela, com o firebase/database trocado por um duplo em
// memória — mesmo padrão de syncService.test.ts.
//
// O que estes testes protegem é o atómico: pagar um mês tem de criar o
// lançamento E marcar o pago na MESMA escrita. Se as duas metades se
// separassem, uma parcela ficava paga sem despesa (ou o contrário) — o tipo de
// divergência que só se descobre meses depois, ao fechar as contas.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DespesaCorrente, Parcela } from "../types";

let dados: Record<string, unknown> = {};
/** Cada chamada a update(), para provar que as duas metades vão juntas. */
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

const s = await import("./parcelasService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5`;

/** 300,00 € em 3× = 100,00 € por mês, a começar em agosto. */
const parcela: Parcela = {
  id: "p1",
  descricao: "Portátil",
  total: 30000,
  numParcelas: 3,
  primeiroMes: "2026-08",
  categoria: "Tecnologia",
  cartao: "Cartão Gold",
  pagoPorMes: {},
};

/** O lançamento criado no último update(), seja qual for a chave gerada. */
function lancamentoCriado(): DespesaCorrente {
  const ultimo = updates[updates.length - 1].mudancas;
  const chave = Object.keys(ultimo).find((k) => k.startsWith("despesasCorrentes/"))!;
  return ultimo[chave] as DespesaCorrente;
}

beforeEach(() => {
  dados = {};
  updates = [];
  contador = 0;
  snapshot.mockClear();
});

describe("pagarMesParcela", () => {
  test("lançamento e marca de pago vão na mesma escrita, a partir da raiz da conta", async () => {
    await s.pagarMesParcela(UID, parcela, "2026-08");
    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(RAIZ);
    const chaves = Object.keys(updates[0].mudancas).map((k) => k.split("/")[0]);
    expect(chaves.sort()).toEqual(["despesasCorrentes", "parcelas"]);
    expect(dados[`${RAIZ}/parcelas/p1/pagoPorMes/2026-08`]).toBe(true);
  });

  test("o lançamento fica vinculado à parcela e ao mês", async () => {
    await s.pagarMesParcela(UID, parcela, "2026-09");
    const l = lancamentoCriado();
    expect(l.origem).toBe("parc");
    expect(l.parcelaId).toBe("p1");
    expect(l.parcelaMes).toBe("2026-09");
    expect(l.valor).toBe(10000);
    expect(l.nota).toBe("2ª de 3");
  });

  test("parcela normal: o lançamento sai no cartão", async () => {
    await s.pagarMesParcela(UID, parcela, "2026-08");
    expect(lancamentoCriado().contaCartao).toBe("Cartão Gold");
  });

  test("débito automático: sai SEM cartão, senão a fatura contava duas vezes", async () => {
    await s.pagarMesParcela(UID, { ...parcela, autoDebit: true }, "2026-08");
    expect(lancamentoCriado()).not.toHaveProperty("contaCartao");
  });

  test("passa pelo histórico", async () => {
    await s.pagarMesParcela(UID, parcela, "2026-08");
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("estornarMesParcela", () => {
  const despesas: DespesaCorrente[] = [
    {
      id: "d1",
      descricao: "Portátil",
      valor: 10000,
      data: "2026-08-10",
      categoria: "Tecnologia",
      origem: "parc",
      parcelaId: "p1",
      parcelaMes: "2026-08",
    },
    {
      id: "d2",
      descricao: "Portátil",
      valor: 10000,
      data: "2026-09-10",
      categoria: "Tecnologia",
      origem: "parc",
      parcelaId: "p1",
      parcelaMes: "2026-09",
    },
    {
      id: "d3",
      descricao: "Café",
      valor: 250,
      data: "2026-08-11",
      categoria: "Alimentação",
    },
  ];

  test("desfaz o pago e remove só o lançamento daquele mês", async () => {
    await s.estornarMesParcela(UID, parcela, "2026-08", despesas);
    expect(updates[0].mudancas).toEqual({
      "parcelas/p1/pagoPorMes/2026-08": null,
      "despesasCorrentes/d1": null,
    });
  });

  test("mês sem lançamento: só desfaz o pago", async () => {
    await s.estornarMesParcela(UID, parcela, "2026-10", despesas);
    expect(updates[0].mudancas).toEqual({ "parcelas/p1/pagoPorMes/2026-10": null });
  });

  test("passa pelo histórico", async () => {
    await s.estornarMesParcela(UID, parcela, "2026-08", despesas);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("quitarParcela", () => {
  test("marca todos os meses em aberto e cria UM lançamento só", async () => {
    await s.quitarParcela(UID, { ...parcela, pagoPorMes: { "2026-08": true } });
    const m = updates[0].mudancas;
    expect(m["parcelas/p1/pagoPorMes/2026-09"]).toBe(true);
    expect(m["parcelas/p1/pagoPorMes/2026-10"]).toBe(true);
    const lancamentos = Object.keys(m).filter((k) => k.startsWith("despesasCorrentes/"));
    expect(lancamentos).toHaveLength(1);
  });

  test("a quitação soma o que falta e é marcada como tal", async () => {
    await s.quitarParcela(UID, { ...parcela, pagoPorMes: { "2026-08": true } });
    const l = lancamentoCriado();
    expect(l.valor).toBe(20000);
    expect(l.parcelaMes).toBe("quit");
    expect(l.descricao).toBe("Portátil (quitação)");
  });

  test("pagamento direto — sem cartão", async () => {
    await s.quitarParcela(UID, parcela);
    expect(lancamentoCriado()).not.toHaveProperty("contaCartao");
  });

  test("nada em aberto: não escreve nem mexe no histórico", async () => {
    await s.quitarParcela(UID, {
      ...parcela,
      pagoPorMes: { "2026-08": true, "2026-09": true, "2026-10": true },
    });
    expect(updates).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });

  test("passa pelo histórico quando há o que quitar", async () => {
    await s.quitarParcela(UID, parcela);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("excluirParcela", () => {
  test("apaga a parcela e deixa os lançamentos já pagos — é dinheiro que saiu", async () => {
    dados[`${RAIZ}/despesasCorrentes/d1`] = { descricao: "Portátil" };
    await s.excluirParcela(UID, parcela);
    expect(updates[0].mudancas).toEqual({ "parcelas/p1": null });
    expect(dados[`${RAIZ}/despesasCorrentes/d1`]).toBeDefined();
  });

  test("passa pelo histórico", async () => {
    await s.excluirParcela(UID, parcela);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
