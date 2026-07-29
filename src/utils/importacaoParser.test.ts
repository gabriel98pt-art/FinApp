import { describe, expect, test } from "vitest";
import { parseExtratoCsv, parseExtratoTextoLivre } from "./importacaoParser";

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

// É o que come o texto reconstruído de um PDF genérico (extrairExtratoPdf):
// sem cabeçalho, a data e o valor estão soltos na linha.
describe("parseExtratoTextoLivre", () => {
  test("acha data e valor soltos na linha; o resto é descrição", () => {
    const linhas = parseExtratoTextoLivre(
      [
        "10/07/2026 COMPRA CONTINENTE ANTAS -45,90",
        "12-07-2026 | TRANSFERENCIA RECEBIDA 1850,00",
      ].join("\n"),
    );
    expect(linhas).toEqual([
      { data: "2026-07-10", descricao: "COMPRA CONTINENTE ANTAS", valor: -4590 },
      { data: "2026-07-12", descricao: "TRANSFERENCIA RECEBIDA", valor: 185000 },
    ]);
  });

  test("descarta linha sem data, sem valor, com valor zero ou curta demais", () => {
    expect(
      parseExtratoTextoLivre(
        ["FARMACIA -20,00", "10/07/2026 SEM VALOR", "10/07/2026 NADA 0,00", "curta"].join("\n"),
      ),
    ).toEqual([]);
  });

  test("não repete a mesma data+valor+descrição (cabeçalho repetido entre páginas)", () => {
    const repetida = "10/07/2026 COMPRA LIDL -9,99";
    expect(parseExtratoTextoLivre([repetida, repetida].join("\n"))).toHaveLength(1);
  });

  // Os dois desvios do original, anotados em importacaoParser.ts.
  test("milhar sem separador não é truncado (1850,00 não vira 850,00)", () => {
    const [linha] = parseExtratoTextoLivre("12/07/2026 SALARIO 1850,00");
    expect(linha).toEqual({ data: "2026-07-12", descricao: "SALARIO", valor: 185000 });
  });

  test("milhar com separador continua a ser lido inteiro", () => {
    expect(parseExtratoTextoLivre("12/07/2026 SALARIO 1.850,00")[0].valor).toBe(185000);
    expect(parseExtratoTextoLivre("12/07/2026 PREMIO 1.234.567,89")[0].valor).toBe(123456789);
  });

  test("data com pontos não é confundida com o valor da linha", () => {
    const [linha] = parseExtratoTextoLivre("10.07.2026 COMPRA GALP -45,90");
    expect(linha).toEqual({ data: "2026-07-10", descricao: "COMPRA GALP", valor: -4590 });
  });
});
