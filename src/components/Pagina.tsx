import { Children, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Paginador from "./Paginador";
import { useMediaQuery } from "../hooks/useMediaQuery";
import styles from "./Pagina.module.css";

const MOBILE = "(max-width: 767px)";
const POR_PAGINA_MOBILE = 2;

/** Esqueleto comum das páginas: título + conteúdo. */
export default function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className={styles.pagina}>
      <h2 className={styles.titulo}>{titulo}</h2>
      {children}
    </section>
  );
}

/** Grid responsivo de KPIs (seção 7). No mobile (<768px), com mais de 2
 *  cartões e fora do modo `denso`, mostra só 2 POR VEZ com um paginador
 *  abaixo — não um grid que quebra em várias linhas, só 2 visíveis na tela.
 *  `denso` (só TVDE) sempre mostra os 4 juntos, em qualquer largura. */
export function Kpis({ children, denso = false }: { children: ReactNode; denso?: boolean }) {
  const mobile = useMediaQuery(MOBILE);
  const [pagina, setPagina] = useState(1);

  const itens = Children.toArray(children);
  const paginar = mobile && !denso && itens.length > POR_PAGINA_MOBILE;

  if (!paginar) {
    return <div className={`${styles.kpis} ${denso ? styles.kpisDenso : ""}`}>{children}</div>;
  }

  const paginas = Math.ceil(itens.length / POR_PAGINA_MOBILE);
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = itens.slice(
    (paginaAtual - 1) * POR_PAGINA_MOBILE,
    paginaAtual * POR_PAGINA_MOBILE,
  );

  return (
    <div className={styles.kpisBloco}>
      <div className={styles.kpis}>{visiveis}</div>
      <Paginador pagina={paginaAtual} paginas={paginas} aoMudar={setPagina} />
    </div>
  );
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
