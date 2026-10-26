import type { Cents, Currency } from "../types";
import { CURRENCY_SYMBOLS, formatCents, formatMoney } from "../utils/money";
import styles from "./ResultadoDoMes.module.css";

/** Quadro de destaque do Início: o resultado do mês (receitas menos despesas,
 *  em fluxo de caixa — os totais chegam prontos, o quadro só os mostra), a
 *  proporção entre o que entrou e o que saiu e os dois totais, que levam às
 *  telas respectivas. Não é o saldo das contas, e a nota diz isso. */
export default function ResultadoDoMes({
  receitas,
  despesas,
  moeda,
  aoAbrirReceitas,
  aoAbrirDespesas,
}: {
  receitas: Cents;
  despesas: Cents;
  moeda: Currency;
  aoAbrirReceitas: () => void;
  aoAbrirDespesas: () => void;
}) {
  const saldo = receitas - despesas;
  const negativo = saldo < 0;
  const simbolo = CURRENCY_SYMBOLS[moeda];
  const numero = formatCents(Math.abs(saldo));
  const virgula = numero.lastIndexOf(",");
  const total = receitas + despesas;
  // Sem movimento nenhum a barra não tem proporção para mostrar: fica a faixa
  // neutra, em vez de fingir 50/50.
  const pctReceitas = total > 0 ? (receitas / total) * 100 : null;

  return (
    <section className={styles.quadro} aria-labelledby="resultado-mes">
      <h3 id="resultado-mes" className={styles.rotulo}>
        Resultado do mês
      </h3>
      <p
        className={`${styles.valor} ${negativo ? styles.negativo : styles.positivo}`}
        role="img"
        aria-label={`${negativo ? "−" : ""}${simbolo} ${numero}`}
      >
        <span className={styles.simbolo} aria-hidden>
          {negativo ? "−" : ""}
          {simbolo}
        </span>
        <span className={styles.inteiro} aria-hidden>
          {numero.slice(0, virgula)}
        </span>
        <span className={styles.centavos} aria-hidden>
          {numero.slice(virgula)}
        </span>
      </p>
      <p className={styles.nota}>Receitas menos despesas · não é o saldo das contas</p>

      <div className={styles.barra} aria-hidden>
        {pctReceitas === null ? (
          <i className={styles.vazia} />
        ) : (
          <>
            <i className={styles.entrada} style={{ width: `${pctReceitas}%` }} />
            <i className={styles.saida} />
          </>
        )}
      </div>

      <div className={styles.totais}>
        <button type="button" className={styles.total} onClick={aoAbrirReceitas}>
          <span className={styles.totalRotulo}>
            <i className={`${styles.bolinha} ${styles.bolinhaEntrada}`} />
            Receitas
          </span>
          <span className={styles.totalValor}>{formatMoney(receitas, moeda)}</span>
        </button>
        <button
          type="button"
          className={`${styles.total} ${styles.direita}`}
          onClick={aoAbrirDespesas}
        >
          <span className={styles.totalRotulo}>
            <i className={`${styles.bolinha} ${styles.bolinhaSaida}`} />
            Despesas
          </span>
          <span className={styles.totalValor}>{formatMoney(despesas, moeda)}</span>
        </button>
      </div>
    </section>
  );
}
