import { describe, expect, test } from "vitest";
import { FOTO_MAX_CHARS, fotoValida, iniciaisDe, NOME_MAX, nomeLimpo } from "./perfil";

describe("iniciaisDe", () => {
  test("uma palavra: uma letra", () => {
    expect(iniciaisDe("ana")).toBe("A");
  });
  test("duas palavras: primeira de cada", () => {
    expect(iniciaisDe("Ana Silva")).toBe("AS");
  });
  test("três palavras: primeira e última", () => {
    expect(iniciaisDe("João Pedro Silva")).toBe("JS");
  });
  test("acentos mantêm-se e vão para maiúsculas", () => {
    expect(iniciaisDe("álvaro éder")).toBe("ÁÉ");
    expect(iniciaisDe("Érica")).toBe("É");
  });
  test("espaços a mais não contam", () => {
    expect(iniciaisDe("  ana    silva  ")).toBe("AS");
  });
  test("sem nome: 1.ª letra do e-mail", () => {
    expect(iniciaisDe("", "gabriel@exemplo.pt")).toBe("G");
    expect(iniciaisDe(null, "zé@exemplo.pt")).toBe("Z");
    expect(iniciaisDe("   ", "x@y.pt")).toBe("X");
  });
  test("sem nome nem e-mail: ponto de interrogação", () => {
    expect(iniciaisDe("", null)).toBe("?");
    expect(iniciaisDe(undefined)).toBe("?");
  });
});

describe("nomeLimpo", () => {
  test("só texto; aparado, sem espaços repetidos e com limite", () => {
    expect(nomeLimpo("  Ana   Silva ")).toBe("Ana Silva");
    expect(nomeLimpo(42)).toBe("");
    expect(nomeLimpo(null)).toBe("");
    expect(nomeLimpo("x".repeat(NOME_MAX + 20))).toHaveLength(NOME_MAX);
  });
});

describe("fotoValida", () => {
  const ok = "data:image/webp;base64,UklGRg==";
  test("aceita JPEG e WebP em data URL", () => {
    expect(fotoValida(ok)).toBe(true);
    expect(fotoValida("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
  });
  test("recusa outros tipos (SVG pode levar script) e lixo", () => {
    expect(fotoValida("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(fotoValida("data:image/png;base64,AAAA")).toBe(false);
    expect(fotoValida("https://x.pt/a.jpg")).toBe(false);
    expect(fotoValida("data:image/webp;base64,<script>")).toBe(false);
    expect(fotoValida("")).toBe(false);
    expect(fotoValida(null)).toBe(false);
    expect(fotoValida(123)).toBe(false);
  });
  test("recusa o que é grande demais", () => {
    const grande = "data:image/webp;base64," + "A".repeat(FOTO_MAX_CHARS);
    expect(fotoValida(grande)).toBe(false);
  });
});
