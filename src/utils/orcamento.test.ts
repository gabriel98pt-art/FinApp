import { describe, expect, test } from "vitest";
import type { DespesaCorrente, Parcela } from "../types";
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
    const status = statusOrcamentoMes(
      despesas,
      [],
      { Alimentação: 20000, Lazer: 0 },
      "2026-07",
      "2026-07",
    );
    expect(status.map((s) => s.categoria)).toEqual(["Alimentação"]);
  });

  test("dentro do teto: estourado=false, pct correto", () => {
    const status = statusOrcamentoMes(despesas, [], { Alimentação: 20000 }, "2026-07", "2026-07");
    expect(status[0]).toMatchObject({ gasto: 15000, teto: 20000, pct: 75, estourado: false });
  });

  test("acima do teto: estourado=true, pct pode passar de 100", () => {
    const status = statusOrcamentoMes(despesas, [], { Saúde: 2000 }, "2026-07", "2026-07");
    expect(status[0]).toMatchObject({ gasto: 3000, teto: 2000, pct: 150, estourado: true });
  });

  test("categoria sem gasto no mês aparece com gasto 0", () => {
    const status = statusOrcamentoMes(despesas, [], { Transporte: 10000 }, "2026-07", "2026-07");
    expect(status[0]).toMatchObject({ gasto: 0, pct: 0, estourado: false });
  });

  test("pagamento de fatura (origem fat) não conta no gasto da categoria", () => {
    const status = statusOrcamentoMes(
      despesas,
      [],
      { "Cartão de Crédito": 5000 },
      "2026-07",
      "2026-07",
    );
    expect(status[0].gasto).toBe(0);
  });

  test("mês errado não vaza pro cálculo", () => {
    const status = statusOrcamentoMes(despesas, [], { Lazer: 1000 }, "2026-07", "2026-07");
    expect(status[0].gasto).toBe(0); // a despesa de Lazer é de junho
  });

  test("parcela conta na categoria dela — pelo plano, não pelo espelho", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        pagoPorMes: { "2026-07": true },
      },
    ];
    const espelho: DespesaCorrente[] = [
      {
        id: "d9",
        descricao: "Sofá (2/3)",
        valor: 10000,
        data: "2026-07-10",
        categoria: "Casa",
        origem: "parc",
      },
    ];
    const status = statusOrcamentoMes(
      [...despesas, ...espelho],
      p,
      { Casa: 20000 },
      "2026-07",
      "2026-07",
    );
    expect(status[0]).toMatchObject({ gasto: 10000, teto: 20000, pct: 50 });
  });

  test("mês fechado: parcela pendente conta cheia; mês corrente, não", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        pagoPorMes: {},
      },
    ];
    expect(statusOrcamentoMes([], p, { Casa: 20000 }, "2026-07", "2026-09")[0].gasto).toBe(10000);
    expect(statusOrcamentoMes([], p, { Casa: 20000 }, "2026-07", "2026-07")[0].gasto).toBe(0);
  });

  // Ninguém marca uma parcela em débito automático — sem tratar isso, ela
  // nunca contava contra o orçamento no mês corrente.
  test("mês corrente: parcela em débito automático conta sem marcação", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        cartao: "AB Gold (C)",
        autoDebit: true,
        pagoPorMes: {},
      },
    ];
    expect(statusOrcamentoMes([], p, { Casa: 20000 }, "2026-07", "2026-07")[0].gasto).toBe(10000);
  });

  test("ordena pelo mais estourado primeiro", () => {
    const status = statusOrcamentoMes(
      despesas,
      [],
      { Alimentação: 20000, Saúde: 2000 },
      "2026-07",
      "2026-07",
    );
    expect(status.map((s) => s.categoria)).toEqual(["Saúde", "Alimentação"]);
  });
});

// ---------------------------------------------------------------------------
// Reembolso: o gasto da categoria já vem líquido, porque o lançamento é
// negativo e este ficheiro soma tudo. O que se confirma aqui é que a redução
// não produz um alerta errado nem uma percentagem absurda.
// ---------------------------------------------------------------------------

describe("orçamento com reembolso", () => {
  const despesa = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente => ({
    id: "d1",
    descricao: "Restaurante",
    valor: 10000,
    data: "2026-07-10",
    categoria: "Restaurante",
    ...extra,
  });

  const jantar = despesa();
  const devolvido = (valor: number) =>
    despesa({
      id: "r1",
      valor: -valor,
      origem: "reemb",
      reembolsoDeId: "d1",
    });

  test("o teto é medido contra o gasto LÍQUIDO", () => {
    // 100,00 gastos com teto de 50,00 estariam estourados; devolvidos 75,00,
    // ficam 25,00 — dentro do teto. Alertar aqui seria alertar sobre dinheiro
    // que a pessoa não gastou.
    const [r] = statusOrcamentoMes(
      [jantar, devolvido(7500)],
      [],
      { Restaurante: 5000 },
      "2026-07",
      "2026-07",
    );

    expect(r.gasto).toBe(2500);
    expect(r.pct).toBe(50);
    expect(r.estourado).toBe(false);
  });

  test("reembolso total: gasto zero, e nada de estouro", () => {
    const [r] = statusOrcamentoMes(
      [jantar, devolvido(10000)],
      [],
      { Restaurante: 5000 },
      "2026-07",
      "2026-07",
    );

    expect(r.gasto).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.estourado).toBe(false);
  });

  test("devolveram mais do que se gastou: percentagem negativa, mas nunca estourado", () => {
    // Caso raro (estorno com juros). O que não pode acontecer é isto contar
    // como estouro — e, ordenado por percentagem, fica no fim da lista, que é
    // onde uma categoria sem problema nenhum deve estar.
    const [r] = statusOrcamentoMes(
      [jantar, devolvido(12000)],
      [],
      { Restaurante: 5000 },
      "2026-07",
      "2026-07",
    );

    expect(r.gasto).toBe(-2000);
    expect(r.estourado).toBe(false);
    expect(r.pct).toBeLessThan(0);
  });

  test("a categoria reembolsada cai para o fim da ordenação", () => {
    const status = statusOrcamentoMes(
      [jantar, devolvido(10000), despesa({ id: "d2", valor: 9000, categoria: "Alimentação" })],
      [],
      { Restaurante: 5000, Alimentação: 10000 },
      "2026-07",
      "2026-07",
    );

    // A que está perto do limite vem primeiro; a zerada por reembolso, no fim.
    expect(status[0].categoria).toBe("Alimentação");
    expect(status[status.length - 1].categoria).toBe("Restaurante");
  });
});
