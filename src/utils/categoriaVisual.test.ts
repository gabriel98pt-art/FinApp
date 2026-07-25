import { describe, expect, it } from "vitest";
import { COR_CATEGORIA_NEUTRA, corDaCategoriaVisual, emojiDaCategoria } from "./categoriaVisual";

const cfg = {
  categoriaEmoji: { Casa: "🏠" },
  categoriaCor: { Casa: "#123456" },
};

describe("corDaCategoriaVisual", () => {
  it("usa a cor escolhida pelo usuário quando existe", () => {
    expect(corDaCategoriaVisual(cfg, "Casa")).toBe("#123456");
  });

  it("cai na cor semântica do nome quando não há escolha", () => {
    expect(corDaCategoriaVisual({ categoriaEmoji: {}, categoriaCor: {} }, "Alimentação")).toBe(
      "#f97316",
    );
  });

  it("cai no cinza neutro para categoria desconhecida", () => {
    expect(corDaCategoriaVisual({ categoriaEmoji: {}, categoriaCor: {} }, "Zzz")).toBe(
      COR_CATEGORIA_NEUTRA,
    );
  });

  it("não quebra com config ausente ou campos faltando (RTDB omite objeto vazio)", () => {
    expect(corDaCategoriaVisual(undefined, "Casa")).toBe("#a78bfa");
    expect(corDaCategoriaVisual({} as unknown as typeof cfg, "Zzz")).toBe(COR_CATEGORIA_NEUTRA);
  });
});

describe("emojiDaCategoria", () => {
  it("devolve o emoji escolhido", () => {
    expect(emojiDaCategoria(cfg, "Casa")).toBe("🏠");
  });

  it("devolve string vazia quando não há escolha", () => {
    expect(emojiDaCategoria(cfg, "Lazer")).toBe("");
    expect(emojiDaCategoria(undefined, "Lazer")).toBe("");
    expect(emojiDaCategoria({} as unknown as typeof cfg, "Lazer")).toBe("");
  });
});
