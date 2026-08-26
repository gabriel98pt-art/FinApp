import { describe, expect, test } from "vitest";
import { CATEGORIAS_DESPESA_PADRAO } from "../constants/categorias";
import {
  PALETA_CATEGORIA,
  PALETA_FALLBACK,
  corFallbackDaCategoria,
  corSemanticaDaCategoria,
} from "./coresCategoria";

/** Matiz aproximada em graus (0-360), só o suficiente para separar "isto é
 *  verde" de "isto não é" num teste — não precisa da precisão perceptual de
 *  OKLCH que a escolha das cores em si já usou (ver comentário de
 *  `PALETA_CATEGORIA`). */
function matizHsl(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
/** Faixa generosa de verde/verde-lima/oliva em HSL — mais larga que a
 *  janela [95°,172°] em OKLCH usada pra escolher as cores novas (escalas
 *  diferentes, este teste só precisa pegar o caso óbvio). */
const EH_VERDE = (hex: string) => {
  const h = matizHsl(hex);
  return h >= 70 && h <= 170;
};

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

  // Achados da auditoria de Design & Cor (daltonismo): as duas categorias de
  // cada par abaixo podem aparecer juntas no mesmo donut, e cores iguais ou
  // quase-indistinguíveis viravam uma fatia só.
  test("Restaurante não é mais idêntico ao laranja do TVDE (--lrj: #fb923c)", () => {
    expect(corSemanticaDaCategoria("Restaurante")).not.toBe("#fb923c");
  });

  test("Seguro não colide mais com Casa sob deuteranopia", () => {
    expect(corSemanticaDaCategoria("Seguro")).not.toBe(corSemanticaDaCategoria("Casa"));
  });

  test("Saúde não colide mais com Transporte sob protanopia (as duas colapsavam quase a zero)", () => {
    expect(corSemanticaDaCategoria("Saúde")).not.toBe(corSemanticaDaCategoria("Transporte"));
  });

  // Pedido do Gabriel: verde só pode existir na categoria Receita. Saúde,
  // Manutenção, Portagens e Revisão usavam verde/oliva sem nenhuma colisão
  // documentada por trás — só uma escolha temática — e por isso são as 4
  // que precisavam de cor nova.
  test("nenhuma categoria fixa além de Receita usa verde/verde-lima/oliva", () => {
    for (const [nome, cor] of Object.entries({
      Saúde: corSemanticaDaCategoria("Saúde")!,
      Manutenção: corSemanticaDaCategoria("Manutenção")!,
      Portagens: corSemanticaDaCategoria("Portagens")!,
      Revisão: corSemanticaDaCategoria("Revisão")!,
    })) {
      expect(EH_VERDE(cor), `${nome}: ${cor}`).toBe(false);
    }
  });

  test("Receita continua verde — o único lugar onde pode estar", () => {
    expect(corSemanticaDaCategoria("Receita")).toBe("#4ade80");
    expect(EH_VERDE(corSemanticaDaCategoria("Receita")!)).toBe(true);
  });

  test("Veículo fica como está — teal deliberado, não é o problema", () => {
    expect(corSemanticaDaCategoria("Veículo")).toBe("#14b8a6");
  });

  // Manutenção/Portagens/Revisão viraram a mesma família (roxo, 3 tons) —
  // mesma lógica de antes (verde claro→escuro), só a matiz mudou. O que
  // importa é que continuam a não colidir com as categorias de veículo mais
  // prováveis de aparecer ao lado delas no mesmo donut.
  test("Manutenção/Portagens/Revisão não colidem com Restaurante nem TVDE", () => {
    const restaurante = corSemanticaDaCategoria("Restaurante");
    const tvde = corSemanticaDaCategoria("TVDE");
    for (const nome of ["Manutenção", "Portagens", "Revisão"]) {
      const cor = corSemanticaDaCategoria(nome);
      expect(cor, nome).not.toBe(restaurante);
      expect(cor, nome).not.toBe(tvde);
    }
  });
});

describe("PALETA_CATEGORIA — fonte única pra auto-atribuição e seletor manual", () => {
  // Um pedido do Gabriel (26/08) chegou a reabrir "verde geral" (#22c55e) de
  // propósito, e ele mesmo voltou atrás no mesmo dia: a regra "verde só na
  // Receita" é imutável mesmo. #22c55e saiu de novo — este teste volta a
  // ser exatamente o que era antes da ida-e-volta.
  test("nenhuma cor da paleta é verde/verde-lima/oliva", () => {
    for (const cor of PALETA_CATEGORIA) {
      expect(EH_VERDE(cor), cor).toBe(false);
    }
  });

  test("tem entre 18 e 28 matizes — o que o pedido de 'mais cores' esperava", () => {
    expect(PALETA_CATEGORIA.length).toBeGreaterThanOrEqual(18);
    expect(PALETA_CATEGORIA.length).toBeLessThanOrEqual(28);
  });

  test("nenhuma cor repetida dentro da própria paleta", () => {
    expect(new Set(PALETA_CATEGORIA).size).toBe(PALETA_CATEGORIA.length);
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
