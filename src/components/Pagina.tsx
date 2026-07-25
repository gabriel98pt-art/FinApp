import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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

/** Grid responsivo de KPIs — auto-fit protege número ímpar de itens (seção 7).
 *  No mobile são sempre 2 por linha, pra a grade ser previsível; `denso` mantém
 *  4 colunas também no mobile (usado só no TVDE). */
export function Kpis({ children, denso = false }: { children: ReactNode; denso?: boolean }) {
  return <div className={`${styles.kpis} ${denso ? styles.kpisDenso : ""}`}>{children}</div>;
}

/** Empty state padronizado (seção 7): para telas/listas REAIS sem dados. */
export function EstadoVazio({
  Icone,
  mensagem,
  sub,
}: {
  Icone: LucideIcon;
  mensagem: string;
  sub?: string;
}) {
  return (
    <div className={styles.estadoVazio}>
      <span className={styles.estadoVazioIcone}>
        <Icone size={26} aria-hidden />
      </span>
      <p className={styles.estadoVazioMsg}>{mensagem}</p>
      {sub !== undefined && <p className={styles.estadoVazioSub}>{sub}</p>}
    </div>
  );
}
