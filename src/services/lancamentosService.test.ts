// Gravação de lançamentos, com o firebase/database trocado por um duplo em
// memória (mesmo padrão de syncService.test.ts). São os testes que os de
// utils/ não dão: aqueles provam a lógica pura, estes provam que o que sai
// daqui vai para o caminho certo do RTDB e passa pelo histórico.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DespesaCorrente, Receita } from "../types";

/** caminho completo no RTDB → valor gravado. */
let dados: Record<string, unknown> = {};
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
  test("marcar pago grava true no mês", async () => {
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", true);
    expect(dados[`${RAIZ}/despesasFixas/f1/pagoPorMes/2026-08`]).toBe(true);
  });

  test("desmarcar remove o mês em vez de gravar false", async () => {
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", true);
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", false);
    expect(dados).toEqual({});
  });

  test("não toca nos outros meses", async () => {
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-07", true);
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", true);
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", false);
    expect(Object.keys(dados)).toEqual([`${RAIZ}/despesasFixas/f1/pagoPorMes/2026-07`]);
  });

  test("passa pelo histórico", async () => {
    await s.alternarPagoDespesaFixa(UID, "f1", "2026-08", true);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("isolamento entre contas", () => {
  test("o uid entra no caminho — nada é gravado fora de users/{uid}", async () => {
    await s.criarReceita("outra-conta", receita);
    expect(Object.keys(dados)[0].startsWith("users/outra-conta/")).toBe(true);
  });
});
