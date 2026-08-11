import type { CSSProperties } from "react";
import styles from "./KpiCard.module.css";

export type TomKpi = "neutro" | "acento" | "verde" | "vermelho" | "amarelo" | "laranja";

/* Cor da "aura" do card (hairline no topo + wash de gradiente), via --_a.
   É a ÚNICA pista de cor do card: o valor em si fica sempre no mesmo cinza
   apagado, seja qual for o tom — quem separa um card do outro é a luz em cima,
   não o número. */
const TOM_COR: Record<TomKpi, string> = {
  neutro: "var(--mut)",
  acento: "var(--blu)",
  verde: "var(--grn)",
  vermelho: "var(--red)",
  amarelo: "var(--ylw)",
  laranja: "var(--lrj)",
};

export default function KpiCard({
  rotulo,
  chave,
  valor,
  sub,
  tom = "neutro",
  discreto = false,
  aoClicar,
}: {
  rotulo: string;
  /** Identidade do card para a escolha de KPIs em Definições (item 8), só
   *  necessária quando `rotulo` muda de texto conforme o estado da tela (ex.
   *  "Total do mês" → "Total da semana"). Sem isto, `Pagina.tsx` casa pelo
   *  próprio `rotulo` — e uma escolha salva deixa de bater assim que o texto
   *  muda de variante, mesmo sem o usuário ter renomeado nada. */
  chave?: string;
  valor: string;
  /** Linha pequena por baixo do valor — para quando o valor principal é um
   *  nome e o número é o detalhe (ex. "Alimentação" / "€ 42,30"). */
  sub?: string;
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
      <p className={`${styles.valor} ${discreto ? "discreto" : ""}`}>{valor}</p>
      {sub && <p className={`${styles.sub} ${discreto ? "discreto" : ""}`}>{sub}</p>}
    </>
  );

  if (aoClicar) {
    return (
      <button
        className={`${styles.card} ${styles.clicavel}`}
        style={estilo}
        onClick={aoClicar}
        data-chave={chave}
      >
        {conteudo}
      </button>
    );
  }

  return (
    <div className={styles.card} style={estilo} data-chave={chave}>
      {conteudo}
    </div>
  );
}
