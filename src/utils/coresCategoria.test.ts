import { describe, expect, test } from "vitest";
import { CATEGORIAS_DESPESA_PADRAO } from "../constants/categorias";
import { PALETA_FALLBACK, coresDasCategorias, corDaCategoria } from "./coresCategoria";

describe("corDaCategoria", () => {
  test("categoria conhecida tem cor fixa, independente da ordem", () => {
    expect(corDaCategoria("Alimentação", 0)).toBe("#f97316");
    expect(corDaCategoria("Alimentação", 7)).toBe("#f97316");
  });

  test("toda categoria padrão do FinApp (+ Veículo) tem cor semântica", () => {
    for (const c of [...CATEGORIAS_DESPESA_PADRAO, "Veículo"]) {
      expect(corDaCategoria(c, 0)).not.toBe(PALETA_FALLBACK[0]);
    }
  });

  test("categoria personalizada cicla a paleta de reserva", () => {
    expect(corDaCategoria("Fidelidade", 0)).toBe(PALETA_FALLBACK[0]);
    expect(corDaCategoria("Fidelidade", 1)).toBe(PALETA_FALLBACK[1]);
    expect(corDaCategoria("Fidelidade", PALETA_FALLBACK.length)).toBe(PALETA_FALLBACK[0]);
  });
});

describe("coresDasCategorias", () => {
  test("as personalizadas não repetem cor entre si", () => {
    const cores = coresDasCategorias(["Alimentação", "Ginásio", "Casa", "Dentista"]);
    expect(cores[0]).toBe("#f97316");
    expect(cores[2]).toBe("#a78bfa");
    expect(cores[1]).toBe(PALETA_FALLBACK[0]);
    expect(cores[3]).toBe(PALETA_FALLBACK[1]);
  });

  test("lista vazia dá lista vazia", () => {
    expect(coresDasCategorias([])).toEqual([]);
  });
});
