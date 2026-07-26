import { describe, expect, it } from "vitest";
import {
  COR_CATEGORIA_NEUTRA,
  ICONE_SOBRE_CLARO,
  ICONE_SOBRE_ESCURO,
  corDaCategoriaVisual,
  corDoIconeSobre,
  iconeDaCategoria,
  luminanciaRelativa,
} from "./categoriaVisual";
import { CORES_CATEGORIA, iconePorId } from "../constants/aparenciaCategoria";

const cfg = {
  categoriaIcone: { Casa: "home" },
  categoriaCor: { Casa: "#123456" },
};

describe("corDaCategoriaVisual", () => {
  it("usa a cor escolhida pelo usuário quando existe", () => {
    expect(corDaCategoriaVisual(cfg, "Casa")).toBe("#123456");
  });

  it("cai na cor semântica do nome quando não há escolha", () => {
    expect(corDaCategoriaVisual({ categoriaIcone: {}, categoriaCor: {} }, "Alimentação")).toBe(
      "#f97316",
    );
  });

  it("cai no cinza neutro para categoria desconhecida", () => {
    expect(corDaCategoriaVisual({ categoriaIcone: {}, categoriaCor: {} }, "Zzz")).toBe(
      COR_CATEGORIA_NEUTRA,
    );
  });

  it("não quebra com config ausente ou campos faltando (RTDB omite objeto vazio)", () => {
    expect(corDaCategoriaVisual(undefined, "Casa")).toBe("#a78bfa");
    expect(corDaCategoriaVisual({} as unknown as typeof cfg, "Zzz")).toBe(COR_CATEGORIA_NEUTRA);
  });
});

describe("iconeDaCategoria", () => {
  it("devolve o id do ícone escolhido", () => {
    expect(iconeDaCategoria(cfg, "Casa")).toBe("home");
  });

  it("devolve string vazia quando não há escolha", () => {
    expect(iconeDaCategoria(cfg, "Lazer")).toBe("");
    expect(iconeDaCategoria(undefined, "Lazer")).toBe("");
    expect(iconeDaCategoria({} as unknown as typeof cfg, "Lazer")).toBe("");
  });

  it("id desconhecido (emoji antigo, grade mudada) não quebra — só não tem ícone", () => {
    expect(iconePorId("🏠")).toBeNull();
    expect(iconePorId("")).toBeNull();
    expect(iconePorId(undefined)).toBeNull();
    expect(iconePorId("home")).not.toBeNull();
  });
});

/** Razão de contraste WCAG entre duas cores — só no teste, pra provar que a
 *  escolha do ícone nunca cai abaixo do limite legível. */
function contraste(a: string, b: string): number {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

describe("corDoIconeSobre — contraste garantido contra a cor de fundo", () => {
  it("fundo escuro pede ícone branco", () => {
    expect(corDoIconeSobre("#0f172a")).toBe(ICONE_SOBRE_ESCURO);
    expect(corDoIconeSobre("#6366f1")).toBe(ICONE_SOBRE_ESCURO);
  });

  it("fundo claro pede ícone quase-preto", () => {
    expect(corDoIconeSobre("#ffffff")).toBe(ICONE_SOBRE_CLARO);
    expect(corDoIconeSobre("#fbbf24")).toBe(ICONE_SOBRE_CLARO);
    expect(corDoIconeSobre("#4ade80")).toBe(ICONE_SOBRE_CLARO);
  });

  it("toda cor da paleta passa de 3:1 (mínimo WCAG pra elemento gráfico)", () => {
    for (const cor of CORES_CATEGORIA) {
      expect(contraste(cor, corDoIconeSobre(cor)), cor).toBeGreaterThanOrEqual(3);
    }
  });

  it("sempre escolhe, das duas tintas, a de MAIOR contraste — o ponto do corte", () => {
    for (const cor of [...CORES_CATEGORIA, "#0f172a", "#ffffff", "#3b82f6", "#22c55e"]) {
      const escolhida = corDoIconeSobre(cor);
      const outra = escolhida === ICONE_SOBRE_CLARO ? ICONE_SOBRE_ESCURO : ICONE_SOBRE_CLARO;
      expect(contraste(cor, escolhida), cor).toBeGreaterThanOrEqual(contraste(cor, outra));
    }
  });

  it("aceita hex de 3 dígitos e com ou sem '#'", () => {
    expect(corDoIconeSobre("#fff")).toBe(ICONE_SOBRE_CLARO);
    expect(corDoIconeSobre("000")).toBe(ICONE_SOBRE_ESCURO);
  });

  it("hex inválido cai no ícone branco em vez de quebrar", () => {
    expect(corDoIconeSobre("nada")).toBe(ICONE_SOBRE_ESCURO);
    expect(corDoIconeSobre("")).toBe(ICONE_SOBRE_ESCURO);
  });
});
