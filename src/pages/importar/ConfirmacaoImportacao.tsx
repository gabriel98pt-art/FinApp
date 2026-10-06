import BottomSheet from "../../components/BottomSheet";
import type { DecisaoLinha, ExistenteParaDedup, LinhaAnalisada } from "../../types";
import { plural } from "./agrupamento";
import { ICONE_DECISAO, ROTULO_DECISAO } from "./constantes";
import styles from "../Importar.module.css";

const ORDEM_DECISOES: DecisaoLinha[] = [
  "auto_classificada",
  "nova",
  "duplicata_provavel",
  "revisao",
];

/** Rodapé fixo da revisão ("N marcados para importar · M de fora" + o botão
 *  principal) e a folha de confirmação que vem antes de gravar.
 *
 *  O número do botão é exatamente o que entra: `confirmarImportacao` grava
 *  todas as linhas marcadas, sem descartar nenhuma — o que falta completar
 *  trava a importação inteira, e por isso trava aqui o botão, com o aviso de
 *  quantas faltam ao lado. A folha separa as duas coisas que antes se
 *  confundiam: linhas do extrato que NÃO entram (ficam de fora, nada lhes
 *  acontece) e lançamentos JÁ REGISTADOS que vão ser excluídos (escolhidos,
 *  com confirmação, na folha de duplicatas). */
export default function ConfirmacaoImportacao({
  linhas,
  totalImportar,
  porCompletar,
  existentesAApagar,
  enviando,
  aberta,
  onAbrir,
  onFechar,
  onImportar,
}: {
  linhas: LinhaAnalisada[];
  totalImportar: number;
  /** Linhas marcadas a que falta um dado obrigatório — travam o botão. */
  porCompletar: number;
  existentesAApagar: ExistenteParaDedup[];
  enviando: boolean;
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onImportar: () => void | Promise<void>;
}) {
  const marcadas = linhas.filter((l) => l.acao === "import");
  const porDecisao = ORDEM_DECISOES.map((d) => ({
    decisao: d,
    n: marcadas.filter((l) => l.decisao === d).length,
  })).filter((g) => g.n > 0);
  const deFora = linhas.length - totalImportar;
  const bloqueado = porCompletar > 0;
  const nApagar = existentesAApagar.length;
  const temFixas = existentesAApagar.some((e) => e.origem === "despesaFixa");

  return (
    <>
      <div className={styles.rodape}>
        <p className={styles.rodapeTexto} role="status" aria-live="polite" aria-atomic="true">
          <span className={styles.rodapeNumero}>{totalImportar}</span>{" "}
          {totalImportar === 1 ? "marcado" : "marcados"} para importar · {deFora} de fora
          {bloqueado && (
            <span className={styles.rodapeBloqueio}>
              {" "}
              · {plural(porCompletar, "linha por completar", "linhas por completar")}
            </span>
          )}
        </p>
        <button
          className={styles.confirmar}
          onClick={onAbrir}
          disabled={enviando || totalImportar === 0 || bloqueado}
        >
          {enviando ? "Aguarde…" : `Importar ${totalImportar}`}
        </button>
      </div>

      <BottomSheet aberta={aberta} aoFechar={onFechar} titulo="Rever antes de importar">
        <div className={styles.resumoFinal}>
          <p className={styles.resumoFinalTotal}>
            <span className={styles.resumoFinalNumero}>{totalImportar}</span>{" "}
            {totalImportar === 1 ? "lançamento entra" : "lançamentos entram"}
          </p>
          <ul className={styles.resumoFinalLista}>
            {porDecisao.map(({ decisao, n }) => {
              const Icone = ICONE_DECISAO[decisao];
              return (
                <li key={decisao} className={styles.resumoFinalItem}>
                  <span className={styles.resumoFinalRotulo}>
                    <Icone size={14} strokeWidth={2.5} aria-hidden />
                    {ROTULO_DECISAO[decisao]}
                  </span>
                  <span className={styles.resumoFinalContagem}>{n}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.resumoFinalFora}>
            {deFora} {deFora === 1 ? "fica" : "ficam"} de fora (não{" "}
            {deFora === 1 ? "será importado" : "serão importados"}).
          </p>
          {nApagar > 0 && (
            <p className={styles.resumoFinalApagar}>
              {nApagar === 1
                ? "1 lançamento existente será excluído."
                : `${nApagar} lançamentos existentes serão excluídos.`}
              {temFixas && " Nas despesas fixas, o mês volta a ficar por pagar."}
            </p>
          )}
        </div>
        <div className={styles.folhaAcoes}>
          <button
            className={styles.confirmar}
            disabled={enviando}
            onClick={() => void onImportar()}
          >
            {enviando ? "Aguarde…" : `Importar ${totalImportar}`}
          </button>
          <button className={styles.botao} disabled={enviando} onClick={onFechar}>
            Voltar à revisão
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
