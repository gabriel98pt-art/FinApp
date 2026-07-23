import type { ReactNode } from "react";
import styles from "./Pagina.module.css";

/** Esqueleto comum das páginas: título + conteúdo. */
export default function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className={styles.pagina}>
      <h2 className={styles.titulo}>{titulo}</h2>
      {children}
    </section>
  );
}

/** Grid responsivo de KPIs — auto-fit protege número ímpar de itens (seção 7). */
export function Kpis({ children }: { children: ReactNode }) {
  return <div className={styles.kpis}>{children}</div>;
}

/** Quadro provisório para conteúdo que chega nos próximos marcos. */
export function EmConstrucao({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.emConstrucao}>
      {children ?? "Em construção — chega no próximo marco."}
    </div>
  );
}
