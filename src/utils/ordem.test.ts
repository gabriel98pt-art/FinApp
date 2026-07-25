import { describe, expect, it } from "vitest";
import { compararPorOrdem } from "./ordem";

const itens = [
  { id: "a", data: "2026-07-10", valor: 500 },
  { id: "b", data: "2026-07-02", valor: 3000 },
  { id: "c", data: "2026-07-20", valor: 1200 },
];

const ids = (o: Parameters<typeof compararPorOrdem>[0]) =>
  [...itens].sort(compararPorOrdem(o)).map((i) => i.id);

describe("compararPorOrdem", () => {
  it("ordena da mais recente para a mais antiga por padrão", () => {
    expect(ids("recentes")).toEqual(["c", "a", "b"]);
  });

  it("ordena da mais antiga para a mais recente", () => {
    expect(ids("antigas")).toEqual(["b", "a", "c"]);
  });

  it("ordena por maior e menor valor", () => {
    expect(ids("maiorValor")).toEqual(["b", "c", "a"]);
    expect(ids("menorValor")).toEqual(["a", "c", "b"]);
  });

  it("funciona igual com YearMonth, não só IsoDate (parcelas)", () => {
    const meses = [
      { id: "x", data: "2026-01", valor: 1 },
      { id: "y", data: "2026-11", valor: 2 },
      { id: "z", data: "2025-12", valor: 3 },
    ];
    expect([...meses].sort(compararPorOrdem("recentes")).map((i) => i.id)).toEqual(["y", "x", "z"]);
  });
});
