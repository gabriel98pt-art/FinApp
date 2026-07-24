import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, DespesaFixa, Receita } from "../types";
import { despesaRealizadaMes, resumoMesCompleto } from "./resumoMensal";

function veiculo(extra: Partial<DadosVeiculo> = {}): DadosVeiculo {
  return { cargas: [], despesas: [], despesasFixas: [], quilometragem: [], ...extra };
}

describe("despesaRealizadaMes — o total do app tem que incluir fixas gerais e veículo", () => {
  test("soma despesas correntes + veículo do mês", () => {
    const despesas: DespesaCorrente[] = [
      { id: "d1", descricao: "Mercado", valor: 5000, data: "2026-07-05", categoria: "Alimentação" },
    ];
    const v = veiculo({
      cargas: [{ id: "c1", data: "2026-07-10", kwh: 40, precoKwh: 25, custo: 1000, local: "Casa" }],
    });
    expect(despesaRealizadaMes(despesas, [], v, "2026-07", "2026-07")).toBe(6000);
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
    expect(despesaRealizadaMes(despesas, [], veiculo(), "2026-07", "2026-07")).toBe(0);
  });

  test("mês corrente: fixa geral ainda não paga não conta na despesa", () => {
    const fixas: DespesaFixa[] = [
      { id: "f1", descricao: "Aluguel", valor: 45000, categoria: "Casa", pagoPorMes: {} },
    ];
    expect(despesaRealizadaMes([], fixas, veiculo(), "2026-07", "2026-07")).toBe(0);
  });

  test("mês fechado (passado): a mesma fixa geral conta o valor cheio", () => {
    const fixas: DespesaFixa[] = [
      { id: "f1", descricao: "Aluguel", valor: 45000, categoria: "Casa", pagoPorMes: {} },
    ];
    expect(despesaRealizadaMes([], fixas, veiculo(), "2026-07", "2026-08")).toBe(45000);
  });
});

test("resumoMesCompleto: saldo = receitas − (despesas correntes + fixas gerais + veículo)", () => {
  const receitas: Receita[] = [
    { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
  ];
  const despesas: DespesaCorrente[] = [
    { id: "d1", descricao: "Mercado", valor: 15000, data: "2026-07-05", categoria: "Alimentação" },
  ];
  const fixas: DespesaFixa[] = [
    {
      id: "f1",
      descricao: "Streaming",
      valor: 999,
      categoria: "Assinaturas",
      pagoPorMes: { "2026-07": true },
    },
  ];
  const v = veiculo({
    despesas: [{ id: "vd1", data: "2026-07-06", valor: 5000, categoria: "Manutenção" }],
  });
  const r = resumoMesCompleto(receitas, despesas, fixas, v, "2026-07", "2026-07");
  expect(r).toEqual({ receitas: 200000, despesas: 20999, saldo: 179001 });
});
