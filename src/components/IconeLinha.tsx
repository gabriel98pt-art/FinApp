import { createElement } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { iconePorId } from "../constants/aparenciaCategoria";
import { useCfgStore } from "../stores/cfgStore";
import { iconeDaCategoria } from "../utils/categoriaVisual";
import styles from "./IconeLinha.module.css";

/** O ícone de 32px das linhas de movimentos (Início, listas de Despesas e
 *  Receitas): o da categoria quando ela tem um escolhido, senão a seta da
 *  direção do dinheiro. Neutro — nunca a cor da categoria — e verde só quando
 *  o dinheiro entra. */
export default function IconeLinha({
  categoria,
  entrada,
}: {
  categoria?: string;
  entrada: boolean;
}) {
  const cfg = useCfgStore((s) => s.cfg);
  const Icone =
    iconePorId(iconeDaCategoria(cfg, categoria ?? "")) ?? (entrada ? ArrowDownLeft : ArrowUpRight);
  return (
    <span className={`${styles.icone} ${entrada ? styles.entrada : ""}`} aria-hidden>
      {/* createElement e não <Icone/>: o ícone vem da lista fixa de constants/, não
          é criado a cada render, apesar do que a regra do eslint sugere. */}
      {createElement(Icone, { size: 17, strokeWidth: 1.75 })}
    </span>
  );
}
