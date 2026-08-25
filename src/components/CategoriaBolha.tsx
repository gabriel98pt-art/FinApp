import { createElement } from "react";
import { iconePorId } from "../constants/aparenciaCategoria";
import { useCfgStore } from "../stores/cfgStore";
import {
  corDaCategoriaVisual,
  corDoIconeSobre,
  iconeDaCategoria,
  inicialDaCategoria,
} from "../utils/categoriaVisual";
import styles from "./CategoriaBolha.module.css";

/** Círculo colorido com o ícone da categoria (item 19). Sem ícone escolhido,
 *  mostra a inicial do nome — nunca vazio nem quebrado. A cor do traço (e da
 *  letra) vem do contraste com o fundo escolhido, não é fixa. */
export default function CategoriaBolha({
  categoria,
  tamanho = 30,
}: {
  categoria: string;
  tamanho?: number;
}) {
  const cfg = useCfgStore((s) => s.cfg);
  const cor = corDaCategoriaVisual(cfg, categoria);
  // `iconePorId` só devolve componentes da lista fixa em constants/ — não
  // cria nada por render, apesar do que a regra do eslint sugere.
  const icone = iconePorId(iconeDaCategoria(cfg, categoria));

  return (
    <span
      className={styles.bolha}
      style={{ width: tamanho, height: tamanho, background: cor }}
      aria-hidden
    >
      {icone ? (
        createElement(icone, {
          size: Math.round(tamanho * 0.54),
          strokeWidth: 2,
          color: corDoIconeSobre(cor),
        })
      ) : (
        // A grade de ícones em Definições é curada e fechada, então categorias
        // que vêm dos dados ("Wise", "Plug and Charge") não têm ícone nenhum
        // para escolher e ficavam como um círculo vazio ao lado de vizinhos
        // com ícone. A inicial preenche a bolha e ainda diz de que categoria
        // se trata.
        <span
          className={styles.inicial}
          style={{ fontSize: Math.round(tamanho * 0.46), color: corDoIconeSobre(cor) }}
        >
          {inicialDaCategoria(categoria)}
        </span>
      )}
    </span>
  );
}
