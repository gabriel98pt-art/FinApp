import { describe, expect, test } from "vitest";
import {
  anoDe,
  doMes,
  MESES_CURTOS_PT,
  mesDe,
  mesDoAno,
  ordenarPorDataDesc,
  receitasNosTotais,
  resumoMes,
  rotuloMes,
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

describe("receitasNosTotais — espelho de despesasNosTotais", () => {
  const salario = { valor: 200000, data: "2026-07-01", origem: undefined };
  const ajuste = { valor: 1250, data: "2026-07-31", origem: "recon" };

  test("ajuste de reconciliação fica fora — não é dinheiro recebido", () => {
    expect(receitasNosTotais([salario, ajuste])).toEqual([salario]);
    expect(totalDoMes(receitasNosTotais([salario, ajuste]), "2026-07")).toBe(200000);
  });

  test("só 'recon' é excluído: 'fat' e 'parc' são casos da despesa, não da receita", () => {
    const comOutraOrigem = [
      { valor: 100, data: "2026-07-02", origem: "fat" },
      { valor: 200, data: "2026-07-03", origem: "parc" },
    ];
    expect(receitasNosTotais(comOutraOrigem)).toEqual(comOutraOrigem);
  });
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

describe("ano e mês para a grade de escolha de mês", () => {
  test("anoDe lê o ano sem passar por Date", () => {
    expect(anoDe("2026-07")).toBe(2026);
    expect(anoDe("1999-12")).toBe(1999);
  });

  test("mesDoAno monta o YearMonth com o zero à esquerda", () => {
    expect(mesDoAno(2026, 1)).toBe("2026-01");
    expect(mesDoAno(2026, 12)).toBe("2026-12");
  });

  test("os dois são o inverso um do outro em todos os meses do ano", () => {
    for (let m = 1; m <= 12; m++) {
      const ym = mesDoAno(2026, m);
      expect(anoDe(ym)).toBe(2026);
      expect(rotuloMes(ym).endsWith("2026")).toBe(true);
    }
  });

  test("os 12 rótulos curtos são distintos e batem com o nome inteiro", () => {
    expect(MESES_CURTOS_PT).toHaveLength(12);
    expect(new Set(MESES_CURTOS_PT).size).toBe(12);
    for (let m = 1; m <= 12; m++) {
      expect(rotuloMes(mesDoAno(2026, m)).startsWith(MESES_CURTOS_PT[m - 1])).toBe(true);
    }
  });
});
