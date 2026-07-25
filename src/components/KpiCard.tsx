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
  discreto = false,
  aoClicar,
}: {
  rotulo: string;
  valor: string;
  tom?: TomKpi;
  /** Modo discreto (seção 4.6): só o valor borra, o rótulo continua legível
   *  — permite navegar em público sem esconder a interface inteira. */
  discreto?: boolean;
  /** Torna o card um botão, mantendo o visual (item 15). Sem isto ele
   *  continua sendo um `<div>` — a maioria dos KPIs não leva a lugar nenhum. */
  aoClicar?: () => void;
}) {
  const estilo = { "--_a": TOM_COR[tom] } as CSSProperties;
  const conteudo = (
    <>
      <p className={styles.rotulo}>{rotulo}</p>
      <p className={`${styles.valor} ${TOM_CLASSE[tom]} ${discreto ? "discreto" : ""}`}>{valor}</p>
    </>
  );

  if (aoClicar) {
    return (
      <button className={`${styles.card} ${styles.clicavel}`} style={estilo} onClick={aoClicar}>
        {conteudo}
      </button>
    );
  }

  return (
    <div className={styles.card} style={estilo}>
      {conteudo}
    </div>
  );
}
