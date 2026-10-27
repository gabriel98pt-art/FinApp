import { Children, useId, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useCfgStore } from "../stores/cfgStore";
import { chaveEmDestaque, COR_DO_TOM } from "../utils/kpis";
import type { PropsKpi } from "./KpiCard";
import QuadroResumo, { NotaDoQuadro, ValorGrande } from "./QuadroResumo";
import styles from "./Pagina.module.css";

/** Esqueleto comum das páginas: título + conteúdo. */
export default function Pagina({
  titulo,
  tituloVisivel = true,
  children,
}: {
  titulo: string;
  /** `false` esconde o título da vista sem o tirar do DOM (a Início). */
  tituloVisivel?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={styles.pagina}>
      <h2 className={`${styles.titulo} ${tituloVisivel ? "" : styles.tituloOculto}`}>{titulo}</h2>
      {children}
    </section>
  );
}

/** O quadro de resumo da página (seção 7): UM cartão com o KPI em destaque em
 *  número grande e os outros em linhas por baixo (rótulo à esquerda, valor à
 *  direita), separadas por um fio. Mostra TODOS os KPIs em qualquer largura — o corte para 2 no telemóvel
 *  acabou.
 *
 *  Qual vai em destaque é escolha da pessoa (Definições → Número em destaque),
 *  por `pagina`; ver `chaveEmDestaque`. Sem `pagina` (Calendário, TVDE), o
 *  primeiro. Os filhos são `KpiCard`: aqui só se lêem as props deles. */
export function Kpis({ children, pagina }: { children: ReactNode; pagina?: string }) {
  const cfg = useCfgStore((s) => s.cfg);
  const idRotulo = useId();

  const itens = Children.toArray(children) as ReactElement<PropsKpi>[];
  if (itens.length === 0) return null;

  // O texto de `chave` casa com `KPIS_POR_PAGINA`; sem ele, é o próprio rótulo.
  const chaveDe = (i: ReactElement<PropsKpi>) => i.props.chave ?? i.props.rotulo;
  const destaqueChave = chaveEmDestaque(pagina, itens.map(chaveDe), cfg);
  const destaque = itens.find((i) => chaveDe(i) === destaqueChave) ?? itens[0];
  const outros = itens.filter((i) => i !== destaque);

  const { rotulo, valor, sub, tom = "neutro", discreto = false, aoClicar } = destaque.props;
  const grande = <ValorGrande texto={valor} cor={COR_DO_TOM[tom]} discreto={discreto} />;

  return (
    <QuadroResumo rotulo={rotulo} idRotulo={idRotulo}>
      {aoClicar ? (
        <button
          type="button"
          className={styles.destaqueBotao}
          onClick={aoClicar}
          aria-label={`${rotulo}: ${valor}`}
        >
          {grande}
        </button>
      ) : (
        grande
      )}
      {sub && <NotaDoQuadro>{sub}</NotaDoQuadro>}
      {outros.length > 0 && <div className={styles.linhas}>{outros}</div>}
    </QuadroResumo>
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
