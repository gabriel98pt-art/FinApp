import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import type { DecisaoLinha, LinhaAnalisada } from "../../types";
import { ICONE_DECISAO, ROTULO_DECISAO } from "./constantes";
import styles from "../Importar.module.css";

const ORDEM_DECISOES: DecisaoLinha[] = [
  "auto_classificada",
  "nova",
  "duplicata_provavel",
  "revisao",
];

/** Botão "Confirmar importação" + a folha de resumo que ele abre: quantas
 *  linhas entram, de que tipo de decisão, e quantas ficam de fora — a última
 *  vista do lote antes de gravar. Só apresentação: o botão final da folha
 *  chama o mesmo `confirmar` de `useImportacao` que o botão chamava antes
 *  (que por sua vez ainda pode abrir a revisão de duplicatas). O "aberta" é
 *  estado só desta tela — não sobrevive a troca de aba, e não precisa. */
export default function ConfirmacaoImportacao({
  linhas,
  totalImportar,
  bloqueado,
  enviando,
  onConfirmar,
}: {
  linhas: LinhaAnalisada[];
  totalImportar: number;
  /** Há linhas marcadas por completar — o botão fica desativado. */
  bloqueado: boolean;
  enviando: boolean;
  onConfirmar: () => void | Promise<void>;
}) {
  const [aberta, setAberta] = useState(false);

  const marcadas = linhas.filter((l) => l.acao === "import");
  const porDecisao = ORDEM_DECISOES.map((d) => ({
    decisao: d,
    n: marcadas.filter((l) => l.decisao === d).length,
  })).filter((g) => g.n > 0);
  const deFora = linhas.length - totalImportar;

  function importarAgora() {
    // Fecha primeiro: se `confirmar` encontrar duplicatas, abre a folha
    // delas no mesmo render, e as duas não ficam empilhadas.
    setAberta(false);
    void onConfirmar();
  }

  return (
    <>
      <button
        className={styles.confirmar}
        onClick={() => setAberta(true)}
        disabled={enviando || totalImportar === 0 || bloqueado}
      >
        {enviando ? "Aguarde…" : `Confirmar importação (${totalImportar})`}
      </button>

      <BottomSheet
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Rever antes de importar"
      >
        <div className={styles.resumoFinal}>
          <p className={styles.resumoFinalTotal}>
            <span className={styles.resumoFinalNumero}>{totalImportar}</span> lançamento(s) vão
            entrar
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
          {deFora > 0 && <p className={styles.resumoFinalFora}>{deFora} linha(s) ficam de fora.</p>}
        </div>
        <button className={styles.confirmar} disabled={enviando} onClick={importarAgora}>
          {enviando ? "Aguarde…" : `Importar agora (${totalImportar})`}
        </button>
      </BottomSheet>
    </>
  );
}
