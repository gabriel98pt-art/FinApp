import { describe, expect, test } from "vitest";
import { agruparPorDia, rotuloDoDia } from "./agruparPorDia";

const i = (id: string, data: string) => ({ id, data });

describe("agruparPorDia", () => {
  test("junta os itens do mesmo dia, mantendo a ordem", () => {
    const grupos = agruparPorDia([
      i("a", "2026-10-24"),
      i("b", "2026-10-23"),
      i("c", "2026-10-23"),
      i("d", "2026-10-20"),
    ]);
    expect(grupos.map((g) => [g.dia, g.itens.map((x) => x.id)])).toEqual([
      ["2026-10-24", ["a"]],
      ["2026-10-23", ["b", "c"]],
      ["2026-10-20", ["d"]],
    ]);
  });

  test("lista vazia dá nenhum grupo", () => {
    expect(agruparPorDia([])).toEqual([]);
  });

  test("em ordem crescente também agrupa", () => {
    const grupos = agruparPorDia([
      i("a", "2026-10-20"),
      i("b", "2026-10-20"),
      i("c", "2026-10-21"),
    ]);
    expect(grupos.map((g) => g.itens.length)).toEqual([2, 1]);
  });
});

describe("rotuloDoDia", () => {
  test("dia da semana, dia e mês curto", () => {
    expect(rotuloDoDia("2026-10-24")).toBe("Sábado, 24 out");
    expect(rotuloDoDia("2026-10-23")).toBe("Sexta, 23 out");
    expect(rotuloDoDia("2026-01-01")).toBe("Quinta, 1 jan");
  });
});
