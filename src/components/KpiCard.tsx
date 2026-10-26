import type { CSSProperties } from "react";
import { COR_DO_TOM, type TomKpi } from "../utils/kpis";
import styles from "./KpiCard.module.css";

export type { TomKpi };

export interface PropsKpi {
  rotulo: string;
  /** Identidade do KPI para a escolha do número em destaque em Definições,
   *  só necessária quando `rotulo` muda de texto conforme o estado da tela (ex.
   *  "Total do mês" → "Total da semana"). Sem isto, `Kpis` casa pelo próprio
   *  `rotulo` — e uma escolha salva deixa de bater assim que o texto muda de
   *  variante, mesmo sem o usuário ter renomeado nada. */
  chave?: string;
  valor: string;
  /** Linha pequena por baixo do valor — para quando o valor principal é um
   *  nome e o número é o detalhe (ex. "Alimentação" / "€ 42,30"). */
  sub?: string;
  tom?: TomKpi;
  /** Modo discreto (seção 4.6): só o valor borra, o rótulo continua legível
   *  — permite navegar em público sem esconder a interface inteira. */
  discreto?: boolean;
  /** Torna o KPI um botão, mantendo o visual (item 15). Sem isto ele
   *  continua sendo um `<div>` — a maioria dos KPIs não leva a lugar nenhum. */
  aoClicar?: () => void;
}

/** Um KPI na sua forma pequena: uma coluna do quadro de resumo (rótulo, valor,
 *  detalhe). O de destaque não passa por aqui — `Kpis` desenha-o grande a
 *  partir das mesmas props. */
export default function KpiCard({
  rotulo,
  chave,
  valor,
  sub,
  tom = "neutro",
  discreto = false,
  aoClicar,
}: PropsKpi) {
  const estilo = { "--_cor": COR_DO_TOM[tom] } as CSSProperties;
  const conteudo = (
    <>
      <span className={styles.rotulo}>{rotulo}</span>
      <span className={`${styles.valor} ${discreto ? "discreto" : ""}`}>{valor}</span>
      {sub && <span className={`${styles.sub} ${discreto ? "discreto" : ""}`}>{sub}</span>}
    </>
  );

  if (aoClicar) {
    return (
      <button
        type="button"
        className={`${styles.coluna} ${styles.clicavel}`}
        style={estilo}
        onClick={aoClicar}
        data-chave={chave}
      >
        {conteudo}
      </button>
    );
  }

  return (
    <div className={styles.coluna} style={estilo} data-chave={chave}>
      {conteudo}
    </div>
  );
}
