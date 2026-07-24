import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual, mesesRecentes, totalDoMes } from "../utils/calculos";
import { despesaRealizadaMes } from "../utils/resumoMensal";
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
}: {
  /** Quantos meses recentes mostrar (6 no Início, 12 em Metas). */
  meses: number;
  titulo?: string;
}) {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const real = mesAtual();
  const lista = mesesRecentes(meses, real);

  const celulas = lista.map((ym) => {
    const futuro = ym > real;
    const r = totalDoMes(receitas, ym);
    const d = futuro ? 0 : despesaRealizadaMes(despesas, veiculo, ym, real);
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
      {titulo && <p className={styles.titulo}>{titulo}</p>}
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
