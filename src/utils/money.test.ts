import { describe, expect, test } from "vitest";
import { formatCents, formatMoney, fromCents, parseMoney, toCents } from "./money";

describe("toCents / fromCents", () => {
  test("converte para centavos inteiros com arredondamento", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1) + toCents(0.2)).toBe(30); // sem erro de float
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(-5.5)).toBe(-550);
  });

  test("fromCents é o inverso para exibição", () => {
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(-550)).toBe(-5.5);
  });
});

describe("parseMoney — formato português", () => {
  test("milhar com ponto e decimal com vírgula", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("12.345.678,90")).toBe(1234567890);
  });

  test("vírgula simples é decimal", () => {
    expect(parseMoney("1,5")).toBe(150);
    expect(parseMoney("0,05")).toBe(5);
    expect(parseMoney("1234,56")).toBe(123456);
  });

  test("ponto seguido de 3 dígitos é milhar pt", () => {
    expect(parseMoney("1.234")).toBe(123400);
  });
});

describe("parseMoney — formato americano", () => {
  test("milhar com vírgula e decimal com ponto", () => {
    expect(parseMoney("1,234.56")).toBe(123456);
    expect(parseMoney("12,345,678.90")).toBe(1234567890);
  });

  test("ponto simples com 1-2 dígitos é decimal", () => {
    expect(parseMoney("0.50")).toBe(50);
    expect(parseMoney("12.5")).toBe(1250);
  });

  test("várias vírgulas sem ponto são milhar", () => {
    expect(parseMoney("1,234,567")).toBe(123456700);
  });
});

describe("parseMoney — notação contábil e sinais", () => {
  test("parênteses viram negativo", () => {
    expect(parseMoney("(1234,56)")).toBe(-123456);
    expect(parseMoney("(1.234,56)")).toBe(-123456);
  });

  test("sinal de menos", () => {
    expect(parseMoney("-12,30")).toBe(-1230);
  });
});

describe("parseMoney — símbolos de moeda colados", () => {
  test("€, $, £ e R$ são tolerados", () => {
    expect(parseMoney("€1.234,56")).toBe(123456);
    expect(parseMoney("1.234,56€")).toBe(123456);
    expect(parseMoney("R$ 99,90")).toBe(9990);
    expect(parseMoney("$1,234.56")).toBe(123456);
    expect(parseMoney("£10")).toBe(1000);
    expect(parseMoney("(€ 50,00)")).toBe(-5000);
  });
});

describe("parseMoney — entradas inválidas", () => {
  test("devolve null para lixo", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("   ")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("12abc34")).toBeNull();
    expect(parseMoney("--5")).toBeNull();
    expect(parseMoney("€")).toBeNull();
  });

  test("número inteiro simples funciona", () => {
    expect(parseMoney("1234")).toBe(123400);
    expect(parseMoney("0")).toBe(0);
  });
});

describe("formatCents / formatMoney", () => {
  test("formata sempre no padrão 1.234,56", () => {
    expect(formatCents(123456)).toBe("1.234,56");
    expect(formatCents(5)).toBe("0,05");
    expect(formatCents(0)).toBe("0,00");
    expect(formatCents(-123456)).toBe("-1.234,56");
    expect(formatCents(1234567890)).toBe("12.345.678,90");
  });

  test("só o símbolo muda entre moedas (seção 4.5)", () => {
    expect(formatMoney(123456, "EUR")).toBe("€ 1.234,56");
    expect(formatMoney(123456, "BRL")).toBe("R$ 1.234,56");
    expect(formatMoney(123456, "USD")).toBe("$ 1.234,56");
    expect(formatMoney(123456, "GBP")).toBe("£ 1.234,56");
  });
});
