import styles from "../Importar.module.css";

/** Barra "N linha(s) · N marcada(s) para importar" + "Novo extrato".
 *
 *  A contagem é uma região `status` (aria-live educado): marcar ou desmarcar
 *  uma linha, ou usar uma ação em massa, muda-a — e quem usa leitor de tela
 *  ouve o novo total sem ter de voltar aqui para o ler. Fica em destaque
 *  quando há alguma linha marcada, por ser o número que o botão de confirmar
 *  vai gravar. */
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
      <span role="status" aria-live="polite" aria-atomic="true">
        {totalLinhas} linha(s) ·{" "}
        <span className={totalImportar > 0 ? styles.resumoMarcadas : undefined}>
          {totalImportar} marcada(s) para importar
        </span>
      </span>
      <button className={styles.linkBotao} onClick={onNovoExtrato}>
        Novo extrato
      </button>
    </div>
  );
}
