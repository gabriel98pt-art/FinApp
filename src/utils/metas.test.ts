import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, DespesaFixa, Fundo, Receita } from "../types";
import { calcularMetaMensal, poupancaMeses, totalFundos } from "./metas";

function veiculo(extra: Partial<DadosVeiculo> = {}): DadosVeiculo {
  return { cargas: [], despesas: [], despesasFixas: [], quilometragem: [], ...extra };
}

const receitas: Receita[] = [
  { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
];

describe("calcularMetaMensal — mês corrente parcial vs. mês fechado total (Parte C)", () => {
  const fixaVeiculo: DespesaFixa = {
    id: "f1",
    descricao: "Seguro carro",
    valor: 5000,
    categoria: "Seguro",
    pagoPorMes: {}, // nunca marcada paga
  };

  test("mês corrente: fixa do veículo ainda não paga NÃO conta na despesa", () => {
    const v = veiculo({ despesasFixas: [fixaVeiculo] });
    const m = calcularMetaMensal(receitas, [], v, "2026-07", "2026-07", 10, 100000);
    expect(m.despesas).toBe(0);
    expect(m.saldo).toBe(200000);
  });

  test("mês fechado (mês passado): a mesma fixa conta o valor cheio", () => {
    const v = veiculo({ despesasFixas: [fixaVeiculo] });
    // mesReal é agosto → julho já fechou
    const m = calcularMetaMensal(receitas, [], v, "2026-07", "2026-08", 10, 100000);
    expect(m.despesas).toBe(5000);
    expect(m.saldo).toBe(195000);
  });

  test("pct clampado entre 0 e 100, mesmo com saldo negativo ou acima da meta", () => {
    const despesas: DespesaCorrente[] = [
      { id: "d1", descricao: "X", valor: 500000, data: "2026-07-05", categoria: "Outros" },
    ];
    const negativo = calcularMetaMensal(
      receitas,
      despesas,
      veiculo(),
      "2026-07",
      "2026-07",
      10,
      100000,
    );
    expect(negativo.pct).toBe(0);
    expect(negativo.atingiu).toBe(false);

    const acima = calcularMetaMensal(receitas, [], veiculo(), "2026-07", "2026-07", 10, 1000);
    expect(acima.pct).toBe(100);
    expect(acima.atingiu).toBe(true);
  });

  test("meta 0/não configurada cai no padrão de 50000 (500 unidades)", () => {
    const m = calcularMetaMensal(receitas, [], veiculo(), "2026-07", "2026-07", 10, 0);
    expect(m.meta).toBe(50000);
  });

  test("badge: mês corrente em curso não é 'fechado' antes do último dia", () => {
    const m = calcularMetaMensal(receitas, [], veiculo(), "2026-07", "2026-07", 15, 100000);
    expect(m.fechado).toBe(false);
  });

  test("badge: mês corrente no último dia já é 'fechado'", () => {
    // julho/2026 tem 31 dias
    const m = calcularMetaMensal(receitas, [], veiculo(), "2026-07", "2026-07", 31, 100000);
    expect(m.fechado).toBe(true);
  });

  test("badge: qualquer mês que não seja o real está sempre fechado", () => {
    const m = calcularMetaMensal(receitas, [], veiculo(), "2026-06", "2026-07", 1, 100000);
    expect(m.fechado).toBe(true);
  });
});

test("totalFundos soma atual e alvo de todos os fundos", () => {
  const fundos: Fundo[] = [
    { id: "f1", nome: "Viagem", atual: 10000, alvo: 50000 },
    { id: "f2", nome: "Emergência", atual: 30000, alvo: 100000 },
  ];
  expect(totalFundos(fundos)).toEqual({ atual: 40000, alvo: 150000 });
  expect(totalFundos([])).toEqual({ atual: 0, alvo: 0 });
});

describe("poupancaMeses — soma só o saldo POSITIVO de cada mês", () => {
  test("mês com saldo negativo conta como zero, não desconta dos outros", () => {
    const receitasMultimes: Receita[] = [
      { id: "r1", descricao: "Jun", valor: 100000, data: "2026-06-01", fonte: "Trabalho" },
      { id: "r2", descricao: "Jul", valor: 50000, data: "2026-07-01", fonte: "Trabalho" },
    ];
    const despesasMultimes: DespesaCorrente[] = [
      { id: "d1", descricao: "Julho caro", valor: 200000, data: "2026-07-05", categoria: "Outros" },
    ];
    // junho: saldo +100000; julho: saldo -150000 → conta 0
    const total = poupancaMeses(
      receitasMultimes,
      despesasMultimes,
      veiculo(),
      ["2026-06", "2026-07"],
      "2026-07",
    );
    expect(total).toBe(100000);
  });
});
