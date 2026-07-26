import { createElement } from "react";
import { iconePorId } from "../constants/aparenciaCategoria";
import { useCfgStore } from "../stores/cfgStore";
import { corDaCategoriaVisual, corDoIconeSobre, iconeDaCategoria } from "../utils/categoriaVisual";
import styles from "./CategoriaBolha.module.css";

/** Círculo colorido com o ícone da categoria (item 19). Categoria sem ícone
 *  fica só com o círculo — nunca vazio nem quebrado. A cor do traço vem do
 *  contraste com o fundo escolhido, não é fixa. */
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
      {icone &&
        createElement(icone, {
          size: Math.round(tamanho * 0.54),
          strokeWidth: 2,
          color: corDoIconeSobre(cor),
        })}
    </span>
  );
}
