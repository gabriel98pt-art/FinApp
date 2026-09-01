// Gravação de lançamentos, com o firebase/database trocado por um duplo em
// memória (mesmo padrão de syncService.test.ts). São os testes que os de
// utils/ não dão: aqueles provam a lógica pura, estes provam que o que sai
// daqui vai para o caminho certo do RTDB e passa pelo histórico.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DespesaCorrente, DespesaFixa, Receita } from "../types";

/** caminho completo no RTDB → valor gravado. */
let dados: Record<string, unknown> = {};
/** Cada chamada a update(), para provar que lançamento + pagoPorMes vão na
 *  mesma escrita (mesmo cuidado de parcelasService.test.ts). */
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

const s = await import("./lancamentosService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5`;

const receita: Omit<Receita, "id"> = {
  descricao: "Salário",
  valor: 150000,
  data: "2026-08-01",
  fonte: "Empresa",
};

beforeEach(() => {
  dados = {};
  updates = [];
  contador = 0;
  snapshot.mockClear();
});

describe("criar", () => {
  test("grava no caminho do domínio e devolve o id novo", async () => {
    const id = await s.criarReceita(UID, receita);
    expect(id).toBe("k1");
    expect(dados[`${RAIZ}/receitas/k1`]).toEqual(receita);
  });

  test("cada domínio escreve no seu caminho", async () => {
    await s.criarDespesa(UID, {
      descricao: "Café",
      valor: 250,
      data: "2026-08-02",
      categoria: "Alimentação",
    });
    await s.criarDespesaFixa(UID, {
      descricao: "Renda",
      valor: 60000,
      categoria: "Casa",
      pagoPorMes: {},
    });
    await s.criarTransferencia(UID, {
      data: "2026-08-03",
      de: "Conta",
      para: "Poupança",
      valor: 10000,
    });
    expect(Object.keys(dados).sort()).toEqual([
      `${RAIZ}/despesasCorrentes/k1`,
      `${RAIZ}/despesasFixas/k2`,
      `${RAIZ}/transferencias/k3`,
    ]);
  });

  test("campos opcionais vazios não são gravados — o RTDB rejeita undefined", async () => {
    await s.criarDespesa(UID, {
      descricao: "Café",
      valor: 250,
      data: "2026-08-02",
      categoria: "Alimentação",
      contaCartao: undefined,
      nota: undefined,
    } as Omit<DespesaCorrente, "id">);
    expect(dados[`${RAIZ}/despesasCorrentes/k1`]).not.toHaveProperty("contaCartao");
    expect(dados[`${RAIZ}/despesasCorrentes/k1`]).not.toHaveProperty("nota");
  });

  test("passa pelo histórico — criar tem de ser desfazível", async () => {
    await s.criarReceita(UID, receita);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("atualizar", () => {
  test("reescreve o mesmo id em vez de criar outro", async () => {
    const id = await s.criarReceita(UID, receita);
    await s.atualizarReceita(UID, { ...receita, id, valor: 160000 });
    expect(Object.keys(dados)).toEqual([`${RAIZ}/receitas/${id}`]);
    expect(dados[`${RAIZ}/receitas/${id}`]).toEqual({ ...receita, valor: 160000 });
  });

  test("o id não vai dentro do valor — é a própria chave", async () => {
    await s.atualizarReceita(UID, { ...receita, id: "abc" });
    expect(dados[`${RAIZ}/receitas/abc`]).not.toHaveProperty("id");
  });

  test("passa pelo histórico", async () => {
    await s.atualizarReceita(UID, { ...receita, id: "abc" });
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("remover", () => {
  test("apaga só aquele id", async () => {
    const a = await s.criarReceita(UID, receita);
    const b = await s.criarReceita(UID, receita);
    await s.removerReceita(UID, a);
    expect(Object.keys(dados)).toEqual([`${RAIZ}/receitas/${b}`]);
  });

  test("passa pelo histórico", async () => {
    await s.removerDespesa(UID, "abc");
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("alternarPagoDespesaFixa", () => {
  const fixa: DespesaFixa = {
    id: "f1",
    descricao: "Renda",
    valor: 60000,
    categoria: "Casa",
    contaCartao: "Cartão Gold",
    pagoPorMes: {},
  };

  /** O lançamento-espelho criado no último update(), seja qual for a chave. */
  function lancamentoCriado(): DespesaCorrente {
    const ultimo = updates[updates.length - 1].mudancas;
    const chave = Object.keys(ultimo).find((k) => k.startsWith("despesasCorrentes/"))!;
    return ultimo[chave] as DespesaCorrente;
  }

  test("marcar pago grava true no mês e cria o lançamento-espelho, na mesma escrita", async () => {
    await s.alternarPagoDespesaFixa(UID, fixa, "2026-08", true, []);
    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(RAIZ);
    const chaves = Object.keys(updates[0].mudancas).map((k) => k.split("/")[0]);
    expect(chaves.sort()).toEqual(["despesasCorrentes", "despesasFixas"]);
    expect(dados[`${RAIZ}/despesasFixas/f1/pagoPorMes/2026-08`]).toBe(true);
  });

  // 01/09/2026: o espelho é o que dá ao Início a DATA REAL do pagamento —
  // sem ele, uma fixa paga com atraso ficava presa ao mês de vencimento no
  // fluxo de caixa (ver despesaRegistradaMes, utils/resumoMensal.ts).
  test("o lançamento fica vinculado à fixa e ao mês, com a data de hoje", async () => {
    await s.alternarPagoDespesaFixa(UID, fixa, "2026-08", true, []);
    const l = lancamentoCriado();
    expect(l.origem).toBe("fixa");
    expect(l.fixaId).toBe("f1");
    expect(l.fixaMes).toBe("2026-08");
    expect(l.valor).toBe(60000);
    expect(l.contaCartao).toBe("Cartão Gold");
  });

  test("desmarcar remove o mês e o lançamento-espelho daquele mês", async () => {
    const despesas: DespesaCorrente[] = [
      {
        id: "d1",
        descricao: "Renda",
        valor: 60000,
        data: "2026-08-05",
        categoria: "Casa",
        origem: "fixa",
        fixaId: "f1",
        fixaMes: "2026-08",
      },
    ];
    await s.alternarPagoDespesaFixa(UID, fixa, "2026-08", false, despesas);
    expect(updates[0].mudancas).toEqual({
      "despesasFixas/f1/pagoPorMes/2026-08": null,
      "despesasCorrentes/d1": null,
    });
  });

  test("desmarcar sem lançamento correspondente: só desfaz o pago", async () => {
    await s.alternarPagoDespesaFixa(UID, fixa, "2026-08", false, []);
    expect(updates[0].mudancas).toEqual({ "despesasFixas/f1/pagoPorMes/2026-08": null });
  });

  test("passa pelo histórico", async () => {
    await s.alternarPagoDespesaFixa(UID, fixa, "2026-08", true, []);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("isolamento entre contas", () => {
  test("o uid entra no caminho — nada é gravado fora de users/{uid}", async () => {
    await s.criarReceita("outra-conta", receita);
    expect(Object.keys(dados)[0].startsWith("users/outra-conta/")).toBe(true);
  });
});
