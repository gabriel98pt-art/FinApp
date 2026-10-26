import { describe, expect, test } from "vitest";
import { partirValor } from "./partirValor";

describe("partirValor", () => {
  test("dinheiro: símbolo, inteiro com milhares e centavos", () => {
    expect(partirValor("€ 1.895,38")).toEqual({
      prefixo: "€",
      inteiro: "1.895",
      centavos: ",38",
      sufixo: "",
    });
  });

  test("negativo, com o menos antes ou depois do símbolo", () => {
    expect(partirValor("−€ 507,00")?.prefixo).toBe("−€");
    expect(partirValor("€ -50,00")).toMatchObject({ inteiro: "50", centavos: ",00" });
    expect(partirValor("€ -50,00")?.prefixo).toContain("-");
  });

  test("percentagem e unidade ficam no sufixo", () => {
    expect(partirValor("+12%")).toEqual({ prefixo: "+", inteiro: "12", centavos: "", sufixo: "%" });
    expect(partirValor("1.234 km")).toMatchObject({ inteiro: "1.234", sufixo: " km" });
  });

  test("um nome não é um número", () => {
    expect(partirValor("Alimentação")).toBeNull();
    expect(partirValor("—")).toBeNull();
  });
});
