import styles from "../Importar.module.css";

/** Barra "N linha(s) · N marcada(s) para importar" + "Novo extrato". */
export default function ImportacaoResumo({
  totalLinhas,
  totalImportar,
  onNovoExtrato,
}: {
  totalLinhas: number;
  totalImportar: number;
  onNovoExtrato: () => void;
}) {
  return (
    <div className={styles.resumo}>
      <span>
        {totalLinhas} linha(s) · {totalImportar} marcada(s) para importar
      </span>
      <button className={styles.linkBotao} onClick={onNovoExtrato}>
        Novo extrato
      </button>
    </div>
  );
}
