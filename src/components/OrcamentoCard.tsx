import { Link } from "react-router-dom";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mesAtual } from "../utils/calculos";
import { formatMoney } from "../utils/money";
import { statusOrcamentoMes } from "../utils/orcamento";
import styles from "./OrcamentoCard.module.css";

/** Orçamento por categoria (seção 4.8): gasto real vs. teto do mês exibido,
 *  com indicação visual quando estoura. Configurável em Definições. */
export default function OrcamentoCard() {
  const cfg = useCfgStore((s) => s.cfg);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);

  // Segue o seletor do header (Planejamento navega por mês). `mesReal` fica
  // no mês de hoje: é ele que decide se a parcela do mês corrente só conta
  // depois de marcada como paga (ver orcamento.ts).
  const mes = useMesVisivelStore((s) => s.mes);
  const status = statusOrcamentoMes(despesas, parcelas, cfg.orcamentos, mes, mesAtual());
  // Breakdown por categoria é sensível (seção 4.6) — borra em modo discreto
  const classeDiscreta = cfg.modoDiscreto ? "discreto" : "";

  if (status.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.titulo}>Orçamento por categoria</p>
        <p className={styles.vazio}>
          Nenhum teto configurado ainda.{" "}
          <Link to="/definicoes" className={styles.link}>
            Configurar em Definições
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.titulo}>Orçamento por categoria</p>
      <div className={styles.lista}>
        {status.map((s) => (
          <div key={s.categoria} className={styles.linha}>
            <div className={styles.linhaTopo}>
              <span className={styles.categoria}>{s.categoria}</span>
              <span
                className={`${s.estourado ? styles.estourado : styles.dentro} ${classeDiscreta}`}
              >
                {formatMoney(s.gasto, cfg.currency)} / {formatMoney(s.teto, cfg.currency)}
              </span>
            </div>
            <div className={styles.barra}>
              <div
                className={`${styles.preenchido} ${s.estourado ? styles.preenchidoEstourado : ""}`}
                style={{ width: `${Math.min(100, s.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
