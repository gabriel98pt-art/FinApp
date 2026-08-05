import { describe, expect, test } from "vitest";
import { aplicarTecla } from "./campoMoeda";

/** Escreve uma sequência de teclas a partir do vazio, como quem digita. */
function digitar(teclas: string) {
  let v: number | null = null;
  for (const t of teclas.split("")) {
    const r = aplicarTecla(v, t);
    if (r !== undefined) v = r;
  }
  return v;
}

describe("dígitos entram pela direita", () => {
  test("cada dígito empurra os anteriores uma casa", () => {
    expect(digitar("1")).toBe(1); // 0,01
    expect(digitar("12")).toBe(12); // 0,12
    expect(digitar("123")).toBe(123); // 1,23
    expect(digitar("123456")).toBe(123456); // 1.234,56
  });

  test("zeros à esquerda não contam", () => {
    expect(digitar("000")).toBe(0);
    expect(digitar("0005")).toBe(5);
  });

  test("a partir de um valor já existente continua a empurrar", () => {
    expect(aplicarTecla(123, "4")).toBe(1234);
  });
});

describe("Backspace tira da direita", () => {
  test("cada Backspace divide por dez, arredondando para baixo", () => {
    expect(aplicarTecla(1234, "Backspace")).toBe(123);
    expect(aplicarTecla(123, "Backspace")).toBe(12);
    expect(aplicarTecla(12, "Backspace")).toBe(1);
  });

  test("o último dígito deixa o campo vazio, não em zero", () => {
    expect(aplicarTecla(1, "Backspace")).toBeNull();
  });

  test("num campo já vazio não estoura", () => {
    expect(aplicarTecla(null, "Backspace")).toBeNull();
  });

  test("Delete faz o mesmo que Backspace", () => {
    expect(aplicarTecla(1234, "Delete")).toBe(123);
  });

  test("escrever e apagar tudo volta ao vazio", () => {
    let v = digitar("1234");
    for (let i = 0; i < 4; i++) v = aplicarTecla(v, "Backspace") as number | null;
    expect(v).toBeNull();
  });
});

describe("teclas que não são para aqui", () => {
  test("vírgula e ponto não fazem nada — não se digitam separadores", () => {
    expect(aplicarTecla(123, ",")).toBeUndefined();
    expect(aplicarTecla(123, ".")).toBeUndefined();
  });

  test("navegação e atalhos passam", () => {
    for (const t of ["Tab", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", "a", "-"]) {
      expect(aplicarTecla(123, t), t).toBeUndefined();
    }
  });
});

describe("teto", () => {
  test("um dígito que ainda cabe entra normalmente", () => {
    // 900.719.925.474.098 × 10 + 9 ainda é um inteiro seguro.
    const cabe = 900719925474098;
    expect(aplicarTecla(cabe, "9")).toBe(9007199254740989);
  });

  test("o dígito que estouraria é ignorado — o campo pára de crescer", () => {
    const naoCabe = Math.floor(Number.MAX_SAFE_INTEGER / 10);
    expect(aplicarTecla(naoCabe, "9")).toBe(naoCabe);
    expect(aplicarTecla(Number.MAX_SAFE_INTEGER, "1")).toBe(Number.MAX_SAFE_INTEGER);
  });
});
