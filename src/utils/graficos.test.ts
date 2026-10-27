import { describe, expect, test } from "vitest";
import { caminhoSuave, pontosDaSerie, tetoDaEscala } from "./graficos";

describe("pontosDaSerie", () => {
  test("zero em baixo, máximo em cima, espaçados por igual", () => {
    expect(pontosDaSerie([0, 50, 100], 100, 200, 100)).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]);
  });

  test("um valor só fica a meio; tudo a zero não dá divisão por zero", () => {
    expect(pontosDaSerie([40], 100, 200, 100)).toEqual([{ x: 100, y: 60 }]);
    const p = pontosDaSerie([0, 0], 0, 100, 50);
    expect(p.every((q) => Number.isFinite(q.y))).toBe(true);
  });

  test("um valor negativo não passa da base", () => {
    expect(pontosDaSerie([-5], 10, 10, 10)[0].y).toBe(10);
  });
});

describe("caminhoSuave", () => {
  test("sem pontos é vazio; com um é só o início", () => {
    expect(caminhoSuave([])).toBe("");
    expect(caminhoSuave([{ x: 1, y: 2 }])).toBe("M1 2");
  });

  test("passa por todos os pontos e nunca sai do intervalo dos vizinhos", () => {
    const d = caminhoSuave([
      { x: 0, y: 50 },
      { x: 10, y: 10 },
      { x: 20, y: 50 },
    ]);
    expect(d.startsWith("M0 50")).toBe(true);
    expect(d).toContain(",20 50");
    expect(d).toContain(",10 10");
    // Os controlos ficam entre 10 e 50: nunca abaixo de 0 nem acima de 50.
    const ys = [...d.matchAll(/C([\d.]+) ([\d.]+),([\d.]+) ([\d.]+)/g)].flatMap((m) => [
      Number(m[2]),
      Number(m[4]),
    ]);
    expect(ys.every((y) => y >= 10 && y <= 50)).toBe(true);
  });
});

describe("tetoDaEscala", () => {
  test("o maior valor com folga; 1 sem dados", () => {
    expect(tetoDaEscala([100, 200], [150])).toBe(216);
    expect(tetoDaEscala([0, 0])).toBe(1);
    expect(tetoDaEscala()).toBe(1);
  });
});
