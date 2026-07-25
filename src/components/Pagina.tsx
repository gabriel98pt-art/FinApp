import { Children, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./Pagina.module.css";

const MOBILE = "(max-width: 767px)";
const NO_MOBILE = 2;

/** Esqueleto comum das páginas: título + conteúdo. */
export default function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <section className={styles.pagina}>
      <h2 className={styles.titulo}>{titulo}</h2>
      {children}
    </section>
  );
}

/** Grid responsivo de KPIs (seção 7). No desktop aparecem todos. No mobile
 *  (<768px) a página mostra só 2 — os que o usuário escolheu em Definições
 *  para aquela `pagina`, ou os 2 primeiros se nunca escolheu (item 8). Sem
 *  paginação: são 2 e pronto.
 *  `denso` (só TVDE) sempre mostra os 4 juntos, em qualquer largura. */
export function Kpis({
  children,
  denso = false,
  pagina,
}: {
  children: ReactNode;
  denso?: boolean;
  /** Id da página em `KPIS_POR_PAGINA` — sem ele não há o que escolher. */
  pagina?: string;
}) {
  const mobile = useMediaQuery(MOBILE);
  const escolhidos = useCfgStore((s) => (pagina ? s.cfg.kpisMobile?.[pagina] : undefined));

  const itens = Children.toArray(children) as ReactElement<{ rotulo?: string }>[];
  if (!mobile || denso || itens.length <= NO_MOBILE) {
    return <div className={`${styles.kpis} ${denso ? styles.kpisDenso : ""}`}>{children}</div>;
  }

  // A escolha é casada pelo rótulo do KpiCard; se um rótulo foi renomeado na
  // tela e não casa mais, a página cai nos 2 primeiros em vez de ficar vazia.
  const porEscolha = escolhidos
    ? itens.filter((i) => escolhidos.includes(i.props?.rotulo ?? ""))
    : [];
  const visiveis = porEscolha.length === NO_MOBILE ? porEscolha : itens.slice(0, NO_MOBILE);

  return <div className={styles.kpis}>{visiveis}</div>;
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
