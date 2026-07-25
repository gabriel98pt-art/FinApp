import { useCfgStore } from "../stores/cfgStore";
import { corDaCategoriaVisual, emojiDaCategoria } from "../utils/categoriaVisual";
import styles from "./CategoriaBolha.module.css";

/** Círculo colorido com o emoji da categoria (item 19). Categoria sem emoji
 *  fica só com o círculo — nunca vazio nem quebrado. */
export default function CategoriaBolha({
  categoria,
  tamanho = 30,
}: {
  categoria: string;
  tamanho?: number;
}) {
  const cfg = useCfgStore((s) => s.cfg);
  const cor = corDaCategoriaVisual(cfg, categoria);
  const emoji = emojiDaCategoria(cfg, categoria);

  return (
    <span
      className={styles.bolha}
      style={{
        width: tamanho,
        height: tamanho,
        background: cor,
        fontSize: Math.round(tamanho * 0.52),
      }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
