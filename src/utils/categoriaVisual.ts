// Aparência de uma categoria (item 19): emoji e cor escolhidos em Definições,
// indexados pelo NOME da categoria e compartilhados entre todas as listas
// (despesa fixa/corrente/veículo, fontes de receita).
//
// Nada aqui pode lançar: categoria sem entrada nenhuma tem que cair num visual
// neutro em vez de quebrar a tela.

import type { ConfigConta } from "../types";
import { corSemanticaDaCategoria } from "./coresCategoria";

/** Cinza neutro do fallback — mesmo tom que "Outros" já usa no donut. */
export const COR_CATEGORIA_NEUTRA = "#94a3b8";

type CfgVisual = Pick<ConfigConta, "categoriaEmoji" | "categoriaCor">;

/** Cor da categoria: escolha do usuário → cor semântica do nome → cinza. */
export function corDaCategoriaVisual(cfg: CfgVisual | undefined, categoria: string): string {
  const escolhida = cfg?.categoriaCor?.[categoria];
  if (escolhida) return escolhida;
  return corSemanticaDaCategoria(categoria) ?? COR_CATEGORIA_NEUTRA;
}

/** Emoji da categoria, ou string vazia quando nunca foi escolhido. */
export function emojiDaCategoria(cfg: CfgVisual | undefined, categoria: string): string {
  return cfg?.categoriaEmoji?.[categoria] ?? "";
}
