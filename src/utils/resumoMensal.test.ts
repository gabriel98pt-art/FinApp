import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, Receita } from "../types";
import { despesaRealizadaMes, resumoMesCompleto } from "./resumoMensal";

function veiculo(extra: Partial<DadosVeiculo> = {}): DadosVeiculo {
  return { cargas: [], despesas: [], despesasFixas: [], quilometragem: [], ...extra };
}

describe("despesaRealizadaMes — o total do app tem que incluir o veículo", () => {
  test("soma despesas correntes + veículo do mês", () => {
    const despesas: DespesaCorrente[] = [
      { id: "d1", descricao: "Mercado", valor: 5000, data: "2026-07-05", categoria: "Alimentação" },
    ];
    const v = veiculo({
      cargas: [{ id: "c1", data: "2026-07-10", kwh: 40, precoKwh: 25, custo: 1000, local: "Casa" }],
    });
    expect(despesaRealizadaMes(despesas, v, "2026-07", "2026-07")).toBe(6000);
  });

  test("pagamento de fatura (origem 'fat') não conta — a compra já contou (4.1)", () => {
    const despesas: DespesaCorrente[] = [
      {
        id: "d1",
        descricao: "Cartão de Crédito",
        valor: 9999,
        data: "2026-07-05",
        categoria: "Cartão de Crédito",
        origem: "fat",
      },
    ];
    expect(despesaRealizadaMes(despesas, veiculo(), "2026-07", "2026-07")).toBe(0);
  });
});

test("resumoMesCompleto: saldo = receitas − (despesas correntes + veículo)", () => {
  const receitas: Receita[] = [
    { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
  ];
  const despesas: DespesaCorrente[] = [
    { id: "d1", descricao: "Mercado", valor: 15000, data: "2026-07-05", categoria: "Alimentação" },
  ];
  const v = veiculo({
    despesas: [{ id: "vd1", data: "2026-07-06", valor: 5000, categoria: "Manutenção" }],
  });
  const r = resumoMesCompleto(receitas, despesas, v, "2026-07", "2026-07");
  expect(r).toEqual({ receitas: 200000, despesas: 20000, saldo: 180000 });
});
