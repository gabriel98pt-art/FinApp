import type { CSSProperties } from "react";
import styles from "./KpiCard.module.css";

export type TomKpi = "neutro" | "acento" | "verde" | "vermelho" | "amarelo";

const TOM_CLASSE: Record<TomKpi, string> = {
  neutro: "",
  acento: styles.acento,
  verde: styles.verde,
  vermelho: styles.vermelho,
  amarelo: styles.amarelo,
};

/* Cor da "aura" do card (hairline no topo + wash de gradiente), via --_a */
const TOM_COR: Record<TomKpi, string> = {
  neutro: "var(--mut)",
  acento: "var(--blu)",
  verde: "var(--grn)",
  vermelho: "var(--red)",
  amarelo: "var(--ylw)",
};

export default function KpiCard({
  rotulo,
  valor,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  tom?: TomKpi;
}) {
  return (
    <div className={styles.card} style={{ "--_a": TOM_COR[tom] } as CSSProperties}>
      <p className={styles.rotulo}>{rotulo}</p>
      <p className={`${styles.valor} ${TOM_CLASSE[tom]}`}>{valor}</p>
    </div>
  );
}
