// Gravação do módulo TVDE, com o firebase/database trocado por um duplo em
// memória — mesmo padrão de syncService.test.ts.
//
// O ponto sensível aqui é o lançamento da receita da semana nas finanças
// gerais: é a única coisa do TVDE que sai do módulo, tem de ser atómica
// (receita + marca juntas) e nunca pode acontecer duas vezes para a mesma
// semana.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DadosTvde, Receita, SemanaTvde } from "../types";

let dados: Record<string, unknown> = {};
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

const s = await import("./tvdeService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5/tvde`;

const semana: SemanaTvde = {
  fat: 100000,
  port: 2000,
  alu: 26000,
  recF: 0,
  extra: 0,
  gorj: 1500,
  recP: 5000,
  horas: 40,
  viag: 60,
  pct: 6,
};

const base: DadosTvde = {
  cfg: s.TVDE_CFG_PADRAO,
  semanas: { "1": semana },
  segPorMes: {},
  lancamentos: {},
  despesas: [],
};

beforeEach(() => {
  dados = {};
  updates = [];
  contador = 0;
  snapshot.mockClear();
});

describe("config e semanas", () => {
  test("a config muda só os campos passados", async () => {
    await s.salvarConfigTvde(UID, { pctFrota: 8 });
    expect(updates[0].caminho).toBe(`${RAIZ}/cfg`);
    expect(updates[0].mudancas).toEqual({ pctFrota: 8 });
  });

  test("a semana é gravada pelo número", async () => {
    await s.salvarSemana(UID, 3, semana);
    expect(dados[`${RAIZ}/semanas/3`]).toEqual(semana);
  });

  test("campos opcionais vazios não são gravados", async () => {
    await s.salvarSemana(UID, 3, { ...semana, teste: undefined });
    expect(dados[`${RAIZ}/semanas/3`]).not.toHaveProperty("teste");
  });

  test("remover apaga só aquela semana", async () => {
    await s.salvarSemana(UID, 3, semana);
    await s.salvarSemana(UID, 4, semana);
    await s.removerSemana(UID, 3);
    expect(Object.keys(dados)).toEqual([`${RAIZ}/semanas/4`]);
  });

  test("tudo isto passa pelo histórico", async () => {
    await s.salvarConfigTvde(UID, { pctFrota: 8 });
    await s.salvarSemana(UID, 3, semana);
    await s.removerSemana(UID, 3);
    expect(snapshot).toHaveBeenCalledTimes(3);
  });
});

describe("definirSegMes", () => {
  test("grava o valor do mês", async () => {
    await s.definirSegMes(UID, "2026-08", 12000);
    expect(dados[`${RAIZ}/segPorMes/2026-08`]).toBe(12000);
  });

  test("zero ou null apagam o mês em vez de gravar 0", async () => {
    await s.definirSegMes(UID, "2026-08", 12000);
    await s.definirSegMes(UID, "2026-08", 0);
    expect(dados).toEqual({});
    await s.definirSegMes(UID, "2026-09", 12000);
    await s.definirSegMes(UID, "2026-09", null);
    expect(dados).toEqual({});
  });

  test("passa pelo histórico", async () => {
    await s.definirSegMes(UID, "2026-08", 12000);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("despesas do módulo", () => {
  test("ficam dentro do TVDE, longe das despesas gerais", async () => {
    await s.criarDespesaTvde(UID, { data: "2026-08-01", descricao: "Lavagem", valor: 1200 });
    expect(Object.keys(dados)).toEqual([`${RAIZ}/despesas/k1`]);
  });

  test("remover apaga aquele id", async () => {
    await s.criarDespesaTvde(UID, { data: "2026-08-01", descricao: "Lavagem", valor: 1200 });
    await s.removerDespesaTvde(UID, "k1");
    expect(dados).toEqual({});
  });

  test("passam pelo histórico", async () => {
    await s.criarDespesaTvde(UID, { data: "2026-08-01", descricao: "Lavagem", valor: 1200 });
    await s.removerDespesaTvde(UID, "k1");
    expect(snapshot).toHaveBeenCalledTimes(2);
  });
});

describe("lancarReceitaSemana", () => {
  test("receita e marca do lançamento vão na mesma escrita", async () => {
    await s.lancarReceitaSemana(UID, 1, base);
    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(`users/${UID}/fin_v5`);
    const chaves = Object.keys(updates[0].mudancas);
    expect(chaves.some((k) => k.startsWith("receitas/"))).toBe(true);
    expect(updates[0].mudancas["tvde/lancamentos/1"]).toBe("k1");
  });

  test("a receita leva o lucro da semana, sem as gorjetas", async () => {
    await s.lancarReceitaSemana(UID, 1, base);
    const receita = updates[0].mudancas["receitas/k1"] as Omit<Receita, "id">;
    // 100000 - 6% frota (6000) - 2000 portagens - 26000 aluguel - 5000 recarga
    expect(receita.valor).toBe(61000);
    expect(receita.fonte).toBe("TVDE");
    expect(receita.descricao).toContain("Semana 1");
  });

  test("recusa lançar a mesma semana duas vezes", async () => {
    const jaLancada = { ...base, lancamentos: { "1": "r1" } };
    await expect(s.lancarReceitaSemana(UID, 1, jaLancada)).rejects.toThrow("já lançada");
    expect(updates).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });

  test("recusa semana que não existe", async () => {
    await expect(s.lancarReceitaSemana(UID, 9, base)).rejects.toThrow("inexistente");
    expect(updates).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });

  test("passa pelo histórico quando lança", async () => {
    await s.lancarReceitaSemana(UID, 1, base);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("desfazerLancamentoSemana", () => {
  test("remove a receita E a marca — juntas", async () => {
    await s.lancarReceitaSemana(UID, 1, base);
    await s.desfazerLancamentoSemana(UID, 1, "k1");
    expect(updates[1].mudancas).toEqual({
      "receitas/k1": null,
      "tvde/lancamentos/1": null,
    });
    expect(dados).toEqual({});
  });

  test("passa pelo histórico", async () => {
    await s.desfazerLancamentoSemana(UID, 1, "r1");
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("normalizarTvde", () => {
  test("conta vazia devolve a config padrão, sem rebentar", () => {
    expect(s.normalizarTvde(null).cfg).toEqual(s.TVDE_CFG_PADRAO);
    expect(s.normalizarTvde(null).semanas).toEqual({});
  });

  test("o RTDB devolve array com buracos quando as chaves são numéricas", () => {
    const bruto = { semanas: [null, semana] } as unknown as Parameters<typeof s.normalizarTvde>[0];
    expect(s.normalizarTvde(bruto).semanas).toEqual({ "1": semana });
  });
});
