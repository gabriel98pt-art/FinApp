// Cor do botão de registro rápido conforme a página aberta. Reaproveita o
// sistema de cor de categoria: "Despesa", "Receita" e "Veículo" entram no
// COR_SEMANTICA como qualquer nome, e `cfg.categoriaCor` continua a mandar
// quando o usuário escolhe outra em Definições — nenhum campo novo em cfg.

import type { ConfigConta } from "../types";
import { corDaCategoriaVisual, corDoIconeSobre } from "./categoriaVisual";

/** As 3 páginas que pintam o botão. Em qualquer outra ele fica no azul do
 *  app (`--blu`), que é o padrão do CSS. */
const NOME_POR_ROTA: Record<string, string> = {
  "/despesas": "Despesa",
  "/receitas": "Receita",
  "/veiculo": "Veículo",
};

type CfgVisual = Pick<ConfigConta, "categoriaIcone" | "categoriaCor">;

/** Estilo a aplicar por cima do CSS, ou `undefined` pra deixar como está.
 *  A cor do "+" acompanha o fundo (claro sobre escuro e vice-versa), senão
 *  uma cor clara escolhida pelo usuário apagaria o ícone. */
export function estiloBotaoRegistro(
  cfg: CfgVisual | undefined,
  pathname: string,
): { background: string; color: string } | undefined {
  const nome = NOME_POR_ROTA[pathname];
  if (!nome) return undefined;
  const fundo = corDaCategoriaVisual(cfg, nome);
  return { background: fundo, color: corDoIconeSobre(fundo) };
}
