import type { CSSProperties, ReactNode } from "react";
import { partirValor } from "../utils/partirValor";
import styles from "./QuadroResumo.module.css";

/** A moldura do quadro de resumo. Quem o usa põe lá dentro o número grande
 *  (`ValorGrande`) e o que vier por baixo. */
export default function QuadroResumo({
  rotulo,
  idRotulo,
  destaque = false,
  children,
}: {
  rotulo: string;
  /** Liga o quadro ao seu título, para quem navega por regiões. */
  idRotulo?: string;
  /** Cartão de destaque em terracota sólido, com texto branco, em vez do vidro. */
  destaque?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`${styles.quadro} ${destaque ? styles.destaque : ""}`}
      aria-labelledby={idRotulo}
    >
      <h3 id={idRotulo} className={styles.rotulo}>
        {rotulo}
      </h3>
      {children}
    </section>
  );
}

/** O número grande: sinal e símbolo e centavos a ≈26px, a parte inteira a
 *  ≈48px. `cor` é a cor do valor (um `var(--…)`); sem ela, a do texto. */
export function ValorGrande({
  texto,
  cor,
  discreto = false,
}: {
  texto: string;
  cor?: string;
  discreto?: boolean;
}) {
  const p = partirValor(texto);
  return (
    <p
      className={`${styles.valor} ${discreto ? "discreto" : ""}`}
      style={cor ? ({ "--_cor": cor } as CSSProperties) : undefined}
      role="img"
      aria-label={texto}
    >
      {p ? (
        <>
          {p.prefixo && (
            <span className={styles.simbolo} aria-hidden>
              {p.prefixo}
            </span>
          )}
          <span className={styles.inteiro} aria-hidden>
            {p.inteiro}
          </span>
          {p.centavos && (
            <span className={styles.centavos} aria-hidden>
              {p.centavos}
            </span>
          )}
          {p.sufixo && (
            <span className={styles.sufixo} aria-hidden>
              {p.sufixo}
            </span>
          )}
        </>
      ) : (
        <span className={styles.texto} aria-hidden>
          {texto}
        </span>
      )}
    </p>
  );
}

/** Linha pequena e apagada por baixo do número grande. */
export function NotaDoQuadro({ children }: { children: ReactNode }) {
  return <p className={styles.nota}>{children}</p>;
}
