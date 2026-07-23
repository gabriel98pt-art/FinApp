import { describe, expect, test } from "vitest";
import { parseExtratoCsv } from "./importacaoParser";

describe("parseExtratoCsv", () => {
  test("delimitador ; com coluna valor única", () => {
    const csv = [
      "Data;Descrição;Valor",
      "10/07/2026;Mercado Continente;-45,90",
      "12/07/2026;Salário;1850,00",
    ].join("\n");
    const linhas = parseExtratoCsv(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      data: "2026-07-10",
      descricao: "Mercado Continente",
      valor: -4590,
    });
    expect(linhas[1]).toEqual({ data: "2026-07-12", descricao: "Salário", valor: 185000 });
  });

  test("delimitador , com colunas débito/crédito separadas", () => {
    const csv = [
      "Date,Description,Debit,Credit",
      "2026-07-10,Farmacia,20.00,",
      "2026-07-11,Salario,,1850.00",
    ].join("\n");
    const linhas = parseExtratoCsv(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].valor).toBe(-2000);
    expect(linhas[1].valor).toBe(185000);
  });

  test("ignora linhas sem data ou com valor zero", () => {
    const csv = ["Data;Descrição;Valor", "sem-data;Algo;10,00", "10/07/2026;Nada;0,00"].join("\n");
    expect(parseExtratoCsv(csv)).toHaveLength(0);
  });

  test("extrato vazio ou só cabeçalho devolve lista vazia", () => {
    expect(parseExtratoCsv("")).toEqual([]);
    expect(parseExtratoCsv("Data;Descrição;Valor")).toEqual([]);
  });
});
