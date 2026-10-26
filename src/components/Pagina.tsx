import { Children, useId, type ReactElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useCfgStore } from "../stores/cfgStore";
import { chaveEmDestaque, COR_DO_TOM } from "../utils/kpis";
import type { PropsKpi } from "./KpiCard";
import QuadroResumo, { NotaDoQuadro, ValorGrande } from "./QuadroResumo";
import styles from "./Pagina.module.css";

/** Colunas pequenas por linha do quadro de resumo. */
const COLUNAS = 3;

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
 *  número grande e os outros em colunas pequenas por baixo, separadas por um
 *  fio. Mostra TODOS os KPIs em qualquer largura — o corte para 2 no telemóvel
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

  // Até 3 por linha; se sobrar, o resto desce para uma segunda linha pequena.
  const linhas: ReactElement<PropsKpi>[][] = [];
  for (let i = 0; i < outros.length; i += COLUNAS) linhas.push(outros.slice(i, i + COLUNAS));

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
      {linhas.map((linha, n) => (
        <div
          key={n}
          className={styles.colunas}
          style={{ gridTemplateColumns: `repeat(${linha.length}, minmax(0, 1fr))` }}
        >
          {linha}
        </div>
      ))}
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
