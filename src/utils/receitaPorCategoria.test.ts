import { describe, expect, test } from "vitest";
import type { Receita } from "../types";
import { maiorFonteMes, receitaPorFonteMes } from "./receitaPorCategoria";

function r(extra: Partial<Receita>): Receita {
  return {
    id: Math.random().toString(36).slice(2),
    descricao: "x",
    valor: 1000,
    data: "2026-07-10",
    fonte: "Trabalho",
    ...extra,
  };
}

describe("receitaPorFonteMes", () => {
  const itens = [
    r({ fonte: "Trabalho", valor: 200000 }),
    r({ fonte: "Extra", valor: 30000 }),
    r({ fonte: "Trabalho", valor: 50000 }),
    r({ fonte: "Aluguel", valor: 80000 }),
    // outro mês: não entra
    r({ fonte: "Extra", valor: 999999, data: "2026-06-10" }),
  ];

  test("agrupa por fonte, soma e ordena da maior pra menor", () => {
    expect(receitaPorFonteMes(itens, "2026-07")).toEqual([
      { fonte: "Trabalho", valor: 250000 },
      { fonte: "Aluguel", valor: 80000 },
      { fonte: "Extra", valor: 30000 },
    ]);
  });

  test("só conta o mês pedido", () => {
    expect(receitaPorFonteMes(itens, "2026-06")).toEqual([{ fonte: "Extra", valor: 999999 }]);
  });

  test("fonte vazia cai em Outros", () => {
    expect(receitaPorFonteMes([r({ fonte: "", valor: 500 })], "2026-07")).toEqual([
      { fonte: "Outros", valor: 500 },
    ]);
  });

  test("maiorFonteMes devolve a primeira, e null em mês sem receita", () => {
    expect(maiorFonteMes(itens, "2026-07")?.fonte).toBe("Trabalho");
    expect(maiorFonteMes(itens, "2026-01")).toBeNull();
    expect(maiorFonteMes([], "2026-07")).toBeNull();
  });

  test("ao contrário da despesa, aqui nada é excluído", () => {
    const so = [r({ fonte: "Aluguer", valor: 1000 })];
    expect(maiorFonteMes(so, "2026-07")?.fonte).toBe("Aluguer");
  });
});
