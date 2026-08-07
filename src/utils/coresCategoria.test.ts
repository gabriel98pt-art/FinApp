import { describe, expect, test } from "vitest";
import { CATEGORIAS_DESPESA_PADRAO } from "../constants/categorias";
import { PALETA_FALLBACK, corFallbackDaCategoria, corSemanticaDaCategoria } from "./coresCategoria";

describe("corSemanticaDaCategoria", () => {
  test("categoria conhecida tem cor fixa", () => {
    expect(corSemanticaDaCategoria("Alimentação")).toBe("#f97316");
  });

  test("toda categoria padrão do FinApp (+ Veículo) tem cor semântica", () => {
    for (const c of [...CATEGORIAS_DESPESA_PADRAO, "Veículo"]) {
      expect(corSemanticaDaCategoria(c)).toBeDefined();
    }
  });

  test("categoria personalizada não tem — é aí que entra o fallback", () => {
    expect(corSemanticaDaCategoria("Fidelidade")).toBeUndefined();
  });
});

describe("corFallbackDaCategoria — pelo nome, não pela posição", () => {
  test("o mesmo nome dá sempre a mesma cor", () => {
    expect(corFallbackDaCategoria("Fidelidade")).toBe(corFallbackDaCategoria("Fidelidade"));
  });

  // O problema que isto resolve: antes a cor vinha da posição na lista, e a
  // mesma categoria saía de uma cor no donut e de outra noutra tela.
  test("a ordem em que as categorias aparecem não muda a cor de nenhuma", () => {
    const nomes = ["Ginásio", "Dentista", "Fidelidade"];
    const cores = nomes.map(corFallbackDaCategoria);
    const invertidas = [...nomes].reverse().map(corFallbackDaCategoria);
    expect(invertidas).toEqual([...cores].reverse());
  });

  test("nomes diferentes tendem a cores diferentes", () => {
    expect(corFallbackDaCategoria("Ginásio")).not.toBe(corFallbackDaCategoria("Dentista"));
  });

  test("a cor sai sempre da paleta", () => {
    for (const nome of ["Ginásio", "Dentista", "Fidelidade", "", "x"]) {
      expect(PALETA_FALLBACK).toContain(corFallbackDaCategoria(nome));
    }
  });
});
