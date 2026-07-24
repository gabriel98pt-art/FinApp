import { describe, expect, test } from "vitest";
import type { DespesaCorrente } from "../types";
import { statusOrcamentoMes } from "./orcamento";

const despesas: DespesaCorrente[] = [
  { id: "d1", descricao: "Continente", valor: 15000, data: "2026-07-05", categoria: "Alimentação" },
  { id: "d2", descricao: "Farmácia", valor: 3000, data: "2026-07-06", categoria: "Saúde" },
  { id: "d3", descricao: "Cinema", valor: 2000, data: "2026-06-01", categoria: "Lazer" }, // outro mês
  {
    id: "d4",
    descricao: "Pagamento fatura",
    valor: 9999,
    data: "2026-07-10",
    categoria: "Cartão de Crédito",
    origem: "fat",
  }, // exclui dos totais (4.1)
];

describe("statusOrcamentoMes — seção 4.8", () => {
  test("só considera categorias com teto configurado (> 0)", () => {
    const status = statusOrcamentoMes(despesas, { Alimentação: 20000, Lazer: 0 }, "2026-07");
    expect(status.map((s) => s.categoria)).toEqual(["Alimentação"]);
  });

  test("dentro do teto: estourado=false, pct correto", () => {
    const status = statusOrcamentoMes(despesas, { Alimentação: 20000 }, "2026-07");
    expect(status[0]).toMatchObject({ gasto: 15000, teto: 20000, pct: 75, estourado: false });
  });

  test("acima do teto: estourado=true, pct pode passar de 100", () => {
    const status = statusOrcamentoMes(despesas, { Saúde: 2000 }, "2026-07");
    expect(status[0]).toMatchObject({ gasto: 3000, teto: 2000, pct: 150, estourado: true });
  });

  test("categoria sem gasto no mês aparece com gasto 0", () => {
    const status = statusOrcamentoMes(despesas, { Transporte: 10000 }, "2026-07");
    expect(status[0]).toMatchObject({ gasto: 0, pct: 0, estourado: false });
  });

  test("pagamento de fatura (origem fat) não conta no gasto da categoria", () => {
    const status = statusOrcamentoMes(despesas, { "Cartão de Crédito": 5000 }, "2026-07");
    expect(status[0].gasto).toBe(0);
  });

  test("mês errado não vaza pro cálculo", () => {
    const status = statusOrcamentoMes(despesas, { Lazer: 1000 }, "2026-07");
    expect(status[0].gasto).toBe(0); // a despesa de Lazer é de junho
  });

  test("ordena pelo mais estourado primeiro", () => {
    const status = statusOrcamentoMes(despesas, { Alimentação: 20000, Saúde: 2000 }, "2026-07");
    expect(status.map((s) => s.categoria)).toEqual(["Saúde", "Alimentação"]);
  });
});
