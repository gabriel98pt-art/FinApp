import { useId } from "react";
import type { BarraSemana, PontoMes } from "../../utils/analise";
import { MESES_CURTOS_PT } from "../../utils/calculos";
import { caminhoSuave, pontosDaSerie, tetoDaEscala } from "../../utils/graficos";
import { formatMoneyInteiro } from "../../utils/money";
import type { Currency } from "../../types";
import styles from "./Graficos.module.css";

const L = 326;
const A = 110;

const rotuloMes = (ym: string) => MESES_CURTOS_PT[Number(ym.slice(5, 7)) - 1];

/** Receitas e despesas mês a mês, duas linhas com área. Eixos mínimos: umas
 *  linhas de grelha e o nome dos meses; os valores vão no resumo em texto
 *  (`aria-label`) e nos números dos cartões ao lado. Pede 2 meses ou mais. */
export function GraficoLinhas({ meses, moeda }: { meses: PontoMes[]; moeda: Currency }) {
  const id = useId().replace(/:/g, "");
  const receitas = meses.map((m) => m.receitas);
  const despesas = meses.map((m) => m.despesas);
  const teto = tetoDaEscala(receitas, despesas);
  const pR = pontosDaSerie(receitas, teto, L, A);
  const pD = pontosDaSerie(despesas, teto, L, A);
  const linhaR = caminhoSuave(pR);
  const linhaD = caminhoSuave(pD);
  const fecho = (p: { x: number; y: number }[]) => `L${p[p.length - 1].x} ${A} L${p[0].x} ${A}Z`;
  const ultimo = meses[meses.length - 1];
  const resumo =
    `Receitas e despesas de ${rotuloMes(meses[0].mes)} a ${rotuloMes(ultimo.mes)}. ` +
    `No último mês, receitas ${formatMoneyInteiro(ultimo.receitas, moeda)} e despesas ${formatMoneyInteiro(ultimo.despesas, moeda)}. ` +
    `As receitas foram de ${formatMoneyInteiro(Math.min(...receitas), moeda)} a ${formatMoneyInteiro(Math.max(...receitas), moeda)}, ` +
    `as despesas de ${formatMoneyInteiro(Math.min(...despesas), moeda)} a ${formatMoneyInteiro(Math.max(...despesas), moeda)}.`;
  // Com muitos meses só se rotula de dois em dois, acabando sempre no último.
  const passo = meses.length > 6 ? 2 : 1;

  return (
    <div>
      <div className={styles.legenda}>
        <span className={styles.legendaItem}>
          <i className={styles.tracoReceitas} aria-hidden />
          Receitas
        </span>
        <span className={styles.legendaItem}>
          <i className={styles.tracoDespesas} aria-hidden />
          Despesas
        </span>
      </div>
      <div className={styles.area} role="img" aria-label={resumo}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${L} ${A}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.gradReceitas} stopOpacity={0.22} />
              <stop offset="1" className={styles.gradReceitas} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${id}d`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.gradDespesas} stopOpacity={0.22} />
              <stop offset="1" className={styles.gradDespesas} stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0.2, 0.55, 0.9].map((f) => (
            <line key={f} className={styles.grelha} x1={0} x2={L} y1={A * f} y2={A * f} />
          ))}
          <path d={`${linhaR} ${fecho(pR)}`} fill={`url(#${id}r)`} />
          <path d={linhaR} className={styles.linhaReceitas} />
          <path d={`${linhaD} ${fecho(pD)}`} fill={`url(#${id}d)`} />
          <path d={linhaD} className={styles.linhaDespesas} />
        </svg>
        {[
          { p: pR[pR.length - 1], cls: styles.marcadorReceitas },
          { p: pD[pD.length - 1], cls: styles.marcadorDespesas },
        ].map(({ p, cls }) => (
          <i
            key={cls}
            className={`${styles.marcador} ${cls}`}
            style={{ left: `${(p.x / L) * 100}%`, top: `${(p.y / A) * 100}%` }}
            aria-hidden
          />
        ))}
      </div>
      <div className={styles.eixoX} aria-hidden>
        {meses.map((m, i) => {
          const noFim = i === meses.length - 1;
          if (!noFim && (meses.length - 1 - i) % passo !== 0) return null;
          const classe = `${styles.rotuloX} ${i === 0 ? styles.rotuloXInicio : ""} ${noFim ? styles.rotuloXFim : ""}`;
          return (
            <span
              key={m.mes}
              className={classe}
              style={{ left: `${(i / (meses.length - 1)) * 100}%` }}
            >
              {rotuloMes(m.mes)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Uma barra por semana do mês: a atual cheia, as passadas esbatidas, as que
 *  ainda não começaram só com o contorno a tracejado. */
export function BarrasSemana({ barras, moeda }: { barras: BarraSemana[]; moeda: Currency }) {
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const resumo =
    "Gasto por semana. " +
    barras
      .map(
        (b) =>
          `${b.rotulo} (${b.intervalo}): ${formatMoneyInteiro(b.valor, moeda)}${b.estado === "atual" ? ", semana atual" : b.estado === "futura" ? ", ainda não começou" : ""}`,
      )
      .join("; ") +
    ".";
  return (
    <div className={styles.barras} role="img" aria-label={resumo}>
      {barras.map((b) => {
        const classe =
          b.estado === "atual"
            ? styles.barraAtual
            : b.estado === "futura"
              ? styles.barraFutura
              : "";
        return (
          <div key={b.rotulo} className={styles.colunaSemana} aria-hidden>
            <div className={styles.trilhoSemana}>
              <div
                className={`${styles.barraSemana} ${classe}`}
                style={{ height: `${Math.max(0, (b.valor / max) * 88)}%` }}
              />
            </div>
            <span
              className={`${styles.rotuloSemana} ${b.estado === "atual" ? styles.rotuloSemanaAtual : ""}`}
            >
              {b.rotulo}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** As barrinhas de uma categoria ao longo da janela: o mês atual cheio, os
 *  outros esbatidos. Só desenho — o resumo em texto vem da linha onde está. */
export function MiniBarras({ serie }: { serie: number[] }) {
  const max = Math.max(1, ...serie);
  return (
    <span className={`${styles.mini} ${serie.length > 8 ? styles.miniEstreita : ""}`} aria-hidden>
      {serie.map((v, i) => (
        <i
          key={i}
          className={`${styles.miniBarra} ${i === serie.length - 1 ? styles.miniBarraAtual : ""}`}
          style={{ height: `${Math.max(3, (v / max) * 22)}px` }}
        />
      ))}
    </span>
  );
}

/** O anel da taxa de poupança: `pct` de 0 a 100, ou `null` ("—") sem receita. */
export function AnelTaxa({ pct }: { pct: number | null }) {
  // Uma taxa negativa deixa o anel vazio (só o trilho); o número diz o resto.
  const cheio = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const texto = pct === null ? "—" : `${pct < 0 ? "−" : ""}${Math.abs(pct)}%`;
  return (
    <svg
      className={styles.anel}
      width={84}
      height={84}
      viewBox="0 0 42 42"
      role="img"
      aria-label={pct === null ? "Taxa de poupança: sem receitas" : `Taxa de poupança: ${texto}`}
    >
      <circle className={styles.anelTrilho} cx={21} cy={21} r={16} />
      <circle
        className={styles.anelValor}
        cx={21}
        cy={21}
        r={16}
        strokeDasharray={`${(cheio / 100) * 100.53} 100.53`}
        transform="rotate(-90 21 21)"
        style={cheio === 0 ? { display: "none" } : undefined}
      />
      <text className={styles.anelTexto} x={21} y={24.5} textAnchor="middle">
        {texto}
      </text>
    </svg>
  );
}
