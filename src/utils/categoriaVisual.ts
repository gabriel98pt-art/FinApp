// Aparência de uma categoria (item 19): ícone e cor escolhidos em Definições,
// indexados pelo NOME da categoria e compartilhados entre todas as listas
// (despesa fixa/corrente/veículo, fontes de receita).
//
// Nada aqui pode lançar: categoria sem entrada nenhuma tem que cair num visual
// neutro em vez de quebrar a tela.

import type { ConfigConta } from "../types";
import { corSemanticaDaCategoria } from "./coresCategoria";

/** Cinza neutro do fallback — mesmo tom que "Outros" já usa no donut. */
export const COR_CATEGORIA_NEUTRA = "#94a3b8";

/** Cores do ícone dentro da bolha: branco em fundo escuro, quase-preto em
 *  fundo claro. O quase-preto (em vez de #000) evita o contraste duro em
 *  amarelos e verdes claros. */
export const ICONE_SOBRE_ESCURO = "#ffffff";
export const ICONE_SOBRE_CLARO = "#0f172a";

type CfgVisual = Pick<ConfigConta, "categoriaIcone" | "categoriaCor">;

/** Cor da categoria: escolha do usuário → cor semântica do nome → cinza. */
export function corDaCategoriaVisual(cfg: CfgVisual | undefined, categoria: string): string {
  const escolhida = cfg?.categoriaCor?.[categoria];
  if (escolhida) return escolhida;
  return corSemanticaDaCategoria(categoria) ?? COR_CATEGORIA_NEUTRA;
}

/** Id do ícone da categoria, ou string vazia quando nunca foi escolhido. */
export function iconeDaCategoria(cfg: CfgVisual | undefined, categoria: string): string {
  return cfg?.categoriaIcone?.[categoria] ?? "";
}

/** '#rgb' ou '#rrggbb' → [r, g, b] em 0-255. Hex inválido devolve `null`. */
export function hexParaRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const completo = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;
  const n = parseInt(completo, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminância relativa (WCAG 2.x), 0 = preto, 1 = branco. */
export function luminanciaRelativa(hex: string): number {
  const rgb = hexParaRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ponto em que o quase-preto passa a contrastar melhor que o branco: onde as
 *  duas razões de contraste (WCAG) se cruzam, dado o `ICONE_SOBRE_CLARO` acima
 *  (luminância ≈ 0,0088). Fica bem abaixo de 0,5 porque o olho — e a fórmula —
 *  já enxergam um verde/amarelo médio como fundo "claro". */
const CORTE_LUMINANCIA = 0.1985;

/** Cor do ícone que garante contraste contra o fundo do círculo: quase-preto
 *  em fundo claro, branco em fundo escuro. Nunca uma cor fixa — é o que impede
 *  ícone escuro em fundo escuro (e vice-versa) quando o usuário escolhe a cor
 *  da categoria. */
export function corDoIconeSobre(fundo: string): string {
  return luminanciaRelativa(fundo) > CORTE_LUMINANCIA ? ICONE_SOBRE_CLARO : ICONE_SOBRE_ESCURO;
}
