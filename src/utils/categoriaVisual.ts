// Aparência de uma categoria (item 19): ícone e cor escolhidos em Definições,
// indexados pelo NOME da categoria e compartilhados entre todas as listas
// (despesa fixa/corrente/veículo, fontes de receita).
//
// Nada aqui pode lançar: categoria sem entrada nenhuma tem que cair num visual
// neutro em vez de quebrar a tela.

import type { ConfigConta } from "../types";
import { corFallbackDaCategoria, corSemanticaDaCategoria } from "./coresCategoria";

/** Cores do ícone dentro da bolha: branco em fundo escuro, quase-preto em
 *  fundo claro. O quase-preto (em vez de #000) evita o contraste duro em
 *  amarelos e verdes claros. */
export const ICONE_SOBRE_ESCURO = "#ffffff";
export const ICONE_SOBRE_CLARO = "#0f172a";

type CfgVisual = Pick<ConfigConta, "categoriaIcone" | "categoriaCor">;

/** Cor da categoria: escolha do usuário → cor semântica do nome → paleta pelo
 *  nome. A ÚNICA fonte de cor de categoria do app.
 *
 *  Havia dois sistemas: este, que respeitava a escolha em Definições mas
 *  mandava toda categoria personalizada para o mesmo cinza; e um do donut, que
 *  dava cores distintas mas pela posição na lista, ignorando a escolha do
 *  usuário — daí o gráfico não obedecer às Definições e a mesma categoria
 *  mudar de cor entre telas. */
export function corDaCategoriaVisual(cfg: CfgVisual | undefined, categoria: string): string {
  const escolhida = cfg?.categoriaCor?.[categoria];
  if (escolhida) return escolhida;
  return corSemanticaDaCategoria(categoria) ?? corFallbackDaCategoria(categoria);
}

/** Id do ícone da categoria, ou string vazia quando nunca foi escolhido. */
export function iconeDaCategoria(cfg: CfgVisual | undefined, categoria: string): string {
  return cfg?.categoriaIcone?.[categoria] ?? "";
}

/** Primeira letra da categoria, em maiúscula — o que a bolha mostra quando não
 *  há ícone escolhido para aquele nome. A grade de ícones em Definições é
 *  curada e fechada de propósito, portanto nomes que vêm dos dados do usuário
 *  ("Wise", "Plug and Charge", "AB Gold → Revolut") nunca vão ter ícone: sem
 *  isto ficavam como um círculo colorido e vazio no meio de uma lista em que
 *  os vizinhos tinham ícone.
 *
 *  `Array.from` em vez de `[0]` para não partir um nome que comece por emoji
 *  ou por letra fora do plano básico. Nome vazio devolve string vazia — a
 *  bolha volta a ser só o círculo, como sempre foi (Transações passa `""`
 *  quando a linha não tem categoria). */
export function inicialDaCategoria(categoria: string): string {
  return Array.from(categoria.trim())[0]?.toUpperCase() ?? "";
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

/** Razão de contraste WCAG entre duas cores (1 a 21). `>= 4.5` é o mínimo AA
 *  para texto normal — o mesmo limite usado pra recusar cores na
 *  personalização (ver `useAplicarCoresPersonalizadas`). */
export function razaoContraste(hexA: string, hexB: string): number {
  const claro = Math.max(luminanciaRelativa(hexA), luminanciaRelativa(hexB));
  const escuro = Math.min(luminanciaRelativa(hexA), luminanciaRelativa(hexB));
  return (claro + 0.05) / (escuro + 0.05);
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
