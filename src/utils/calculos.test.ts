import { describe, expect, test } from "vitest";
import {
  doMes,
  mesDe,
  ordenarPorDataDesc,
  resumoMes,
  saldoTotal,
  total,
  totalDoMes,
} from "./calculos";

const receitas = [
  { valor: 200000, data: "2026-07-01" },
  { valor: 120000, data: "2026-07-15" },
  { valor: 90000, data: "2026-06-28" },
];

const despesas = [
  { valor: 30000, data: "2026-07-05" },
  { valor: 5000, data: "2026-07-10" },
  { valor: 10000, data: "2026-06-20" },
];

test("mesDe corta a string sem passar por Date", () => {
  expect(mesDe("2026-07-23")).toBe("2026-07");
});

test("total soma centavos e lista vazia dá zero", () => {
  expect(total(despesas)).toBe(45000);
  expect(total([])).toBe(0);
});

test("doMes/totalDoMes filtram só o mês pedido", () => {
  expect(doMes(receitas, "2026-07")).toHaveLength(2);
  expect(totalDoMes(receitas, "2026-07")).toBe(320000);
  expect(totalDoMes(receitas, "2026-05")).toBe(0);
});

describe("resumoMes (regressão do app antigo: mês errado não pode vazar)", () => {
  test("julho", () => {
    expect(resumoMes(receitas, despesas, "2026-07")).toEqual({
      receitas: 320000,
      despesas: 35000,
      saldo: 285000,
    });
  });

  test("junho fica negativo sem vazar julho", () => {
    expect(resumoMes(receitas, despesas, "2026-06")).toEqual({
      receitas: 90000,
      despesas: 10000,
      saldo: 80000,
    });
  });

  test("mês sem lançamentos zera tudo", () => {
    expect(resumoMes(receitas, despesas, "2025-01")).toEqual({
      receitas: 0,
      despesas: 0,
      saldo: 0,
    });
  });
});

test("saldoTotal acumula tudo", () => {
  expect(saldoTotal(receitas, despesas)).toBe(410000 - 45000);
});

test("ordenarPorDataDesc não muta a lista original", () => {
  const ordenada = ordenarPorDataDesc(despesas);
  expect(ordenada.map((d) => d.data)).toEqual(["2026-07-10", "2026-07-05", "2026-06-20"]);
  expect(despesas[0].data).toBe("2026-07-05");
});
