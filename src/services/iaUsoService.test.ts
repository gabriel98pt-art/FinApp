// Cota diária da camada 2. O que importa aqui é o contador não escorregar:
// contar a menos é dinheiro gasto a mais, e falhar a contar não pode virar
// "pode chamar à vontade".

import { beforeEach, describe, expect, test, vi } from "vitest";

/** Valor guardado no nó da cota, entre chamadas. */
let guardado: number | null = null;
/** Faz a transação rebentar, como quando a rede cai a meio. */
let falhar = false;

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  runTransaction: async (_r: unknown, atualizar: (v: unknown) => unknown) => {
    if (falhar) throw new Error("sem rede");
    const proposto = atualizar(guardado);
    // `undefined` aborta: é assim que o SDK real trata o valor de retorno.
    if (proposto === undefined) return { committed: false };
    guardado = proposto as number;
    return { committed: true };
  },
}));

const s = await import("./iaUsoService");

beforeEach(() => {
  guardado = null;
  falhar = false;
});

describe("consumirCotaIA", () => {
  test("a primeira pergunta do dia começa o contador em 1", async () => {
    expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(true);
    expect(guardado).toBe(1);
  });

  test("vai somando a cada pergunta", async () => {
    await s.consumirCotaIA("u1", "2026-07-15");
    await s.consumirCotaIA("u1", "2026-07-15");
    await s.consumirCotaIA("u1", "2026-07-15");

    expect(guardado).toBe(3);
  });

  test("deixa passar exactamente o limite, e nem mais uma", async () => {
    for (let i = 0; i < s.LIMITE_DIARIO_IA; i++) {
      expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(true);
    }

    expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(false);
    // A recusa não pode continuar a somar: o contador pára no limite.
    expect(guardado).toBe(s.LIMITE_DIARIO_IA);
  });

  test("falhar a contar recusa a chamada, em vez de a deixar passar", async () => {
    // Sem conseguir contar, não há como saber quanto já se gastou. O seguro é
    // não chamar — o contrário abria a porta a chamadas sem tecto sempre que
    // a rede fosse instável.
    falhar = true;

    expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(false);
  });

  test("valor corrompido no nó é tratado como zero, não rebenta", async () => {
    guardado = "muitas" as unknown as number;

    expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(true);
    expect(guardado).toBe(1);
  });

  test("cada dia tem a sua contagem", async () => {
    for (let i = 0; i < s.LIMITE_DIARIO_IA; i++) await s.consumirCotaIA("u1", "2026-07-15");
    expect(await s.consumirCotaIA("u1", "2026-07-15")).toBe(false);

    // O nó do dia seguinte é outro caminho e nasce vazio.
    guardado = null;
    expect(await s.consumirCotaIA("u1", "2026-07-16")).toBe(true);
  });
});
