import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import type { YearMonth } from "../types";
import { hojeIso, mesAtual, receitasNosTotais, totalDoMes } from "../utils/calculos";
import { despesaRealizadaMes, janelaResumoAnual } from "../utils/resumoMensal";
import { formatCents, formatMoney } from "../utils/money";
import styles from "./ResumoAnual.module.css";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Grid de resumo mensal (receita/despesa/saldo) — mesmo componente usado no
 *  card compacto do Início e na tabela completa de Metas (a origem
 *  unificava os dois widgets numa única função de render). */
export default function ResumoAnual({
  meses,
  titulo,
  ate,
}: {
  /** Quantos meses recentes mostrar (6 no Início, 12 em Metas). */
  meses: number;
  titulo?: string;
  /** Onde a janela termina. O Início ancora-a no mês do seletor do header;
   *  sem o prop (Metas) fica em hoje, como sempre foi. Não confundir com o
   *  "hoje" que marca as células futuras — esse é sempre o real. */
  ate?: YearMonth;
}) {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const real = mesAtual();
  // O dia de hoje dá precisão de DIA ao mês corrente — sem ele, uma fixa ou
  // parcela em débito automático que só vence dia 27 já contava aqui no dia 18,
  // e o rodapé deste quadro discordava do KPI "Despesas" logo acima no Início
  // (que passa `hojeIso()` via `resumoMesCompleto`) e do card de Metas. Era o
  // único sítio da app a chamar `despesaRealizadaMes` sem ele. Ver
  // `fixaEfetivamentePaga`/`estaEfetivamentePaga`.
  const hoje = hojeIso();

  const celulas = janelaResumoAnual(meses, ate ?? real, real).map(({ ym, futuro }) => {
    const r = totalDoMes(receitasNosTotais(receitas), ym);
    const d = futuro
      ? 0
      : despesaRealizadaMes(despesas, despesasFixas, parcelas, veiculo, ym, real, hoje);
    const [, mi] = ym.split("-").map(Number);
    return { ym, futuro, receitas: r, despesas: d, saldo: r - d, rotulo: MESES_ABREV[mi - 1] };
  });

  const { totalReceitas, totalDespesas } = celulas
    .filter((c) => !c.futuro)
    .reduce(
      (acc, c) => ({
        totalReceitas: acc.totalReceitas + c.receitas,
        totalDespesas: acc.totalDespesas + c.despesas,
      }),
      { totalReceitas: 0, totalDespesas: 0 },
    );

  return (
    <div className={styles.card}>
      {/* h3 e não p: é o cabeçalho do quadro, e quem navega por cabeçalhos
          (leitor de ecrã) não tinha como saltar de um quadro para o outro no
          Início. O `.titulo` já fixa tamanho e peso, então o desenho não muda.
          O Copiloto já era h3 — isto alinha o resto. */}
      {titulo && <h3 className={styles.titulo}>{titulo}</h3>}
      <div className={styles.grid}>
        {celulas.map((c) => (
          <div
            key={c.ym}
            className={`${styles.celula} ${c.futuro ? styles.futura : c.saldo > 0 ? styles.positiva : c.saldo < 0 ? styles.negativa : ""}`}
          >
            <span className={styles.mes}>{c.rotulo}</span>
            <span className={`${styles.valor} ${modoDiscreto ? "discreto" : ""}`}>
              {c.futuro
                ? "·"
                : c.saldo === 0
                  ? "—"
                  : `${c.saldo > 0 ? "+" : ""}${formatCents(c.saldo)}`}
            </span>
          </div>
        ))}
      </div>
      <div className={`${styles.rodape} ${modoDiscreto ? "discreto" : ""}`}>
        <span>
          Receitas <strong className={styles.verde}>{formatMoney(totalReceitas, moeda)}</strong>
        </span>
        <span>
          Despesas <strong className={styles.vermelho}>{formatMoney(totalDespesas, moeda)}</strong>
        </span>
        <span>
          Saldo{" "}
          <strong className={totalReceitas - totalDespesas >= 0 ? styles.verde : styles.vermelho}>
            {formatMoney(totalReceitas - totalDespesas, moeda)}
          </strong>
        </span>
      </div>
    </div>
  );
}
