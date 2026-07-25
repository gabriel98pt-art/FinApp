import { PieChart } from "lucide-react";
import { EstadoVazio } from "./Pagina";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual, rotuloMes } from "../utils/calculos";
import { coresDasCategorias } from "../utils/coresCategoria";
import { despesaPorCategoriaMes, paradasDonut } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import styles from "./DonutCategoriaCard.module.css";

/** Donut de despesas por categoria do mês (seção 7 / dashboard do app de
 *  referência). Sem lib de gráfico: `conic-gradient` num círculo + um círculo
 *  da cor do card por cima faz o buraco do meio (equivale ao cutout 65%). */
export default function DonutCategoriaCard() {
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  // O Início ainda não tem seletor de mês — fica no mês real (o mês global
  // compartilhado entra aqui quando esta tela for ajustada).
  const mes = mesAtual();
  const fatias = despesaPorCategoriaMes(despesas, despesasFixas, veiculo, mes, mes);
  const cores = coresDasCategorias(fatias.map((f) => f.categoria));
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  if (fatias.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.titulo}>Despesas por categoria</p>
        <EstadoVazio
          Icone={PieChart}
          mensagem={`Nenhuma despesa em ${rotuloMes(mes)}`}
          sub="As categorias aparecem aqui assim que houver gastos no mês."
        />
      </div>
    );
  }

  const paradas = paradasDonut(fatias, cores);

  return (
    <div className={styles.card}>
      <p className={styles.titulo}>Despesas por categoria</p>

      <div className={styles.corpo}>
        <div
          className={styles.donut}
          style={{ background: `conic-gradient(${paradas.join(", ")})` }}
          role="img"
          aria-label={`Despesas de ${rotuloMes(mes)} por categoria: ${fatias
            .map((f) => `${f.categoria} ${f.pct}%`)
            .join(", ")}`}
        >
          <span className={styles.buraco} />
        </div>

        <ul className={styles.legenda}>
          {fatias.map((f, i) => (
            <li key={f.categoria} className={styles.item}>
              <span className={styles.bolinha} style={{ background: cores[i] }} />
              <span className={styles.categoria}>{f.categoria}</span>
              <span className={styles.pct}>{f.pct}%</span>
              <span className={`${styles.valor} ${classeDiscreta}`}>
                {formatMoney(f.valor, cfg.currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
