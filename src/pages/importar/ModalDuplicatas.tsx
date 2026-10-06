import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { formatMoney } from "../../utils/money";
import type { Currency, LinhaAnalisada } from "../../types";
import { descricaoExistente } from "./constantes";
import styles from "../Importar.module.css";

/** Antes da confirmação, quando algo do que vai entrar já parece existir: o
 *  que vem no extrato ao lado do que já está registado.
 *
 *  A ação principal ("Importar mesmo assim") mantém os dois. Excluir o
 *  registo ANTIGO é uma ação secundária, linha a linha, com um passo de
 *  confirmação próprio — a pontuação de duplicata é palpite, e apagar por
 *  engano um lançamento verdadeiro é pior do que ficar com um repetido. Só
 *  depois desse passo a exclusão entra no que é gravado. */
export default function ModalDuplicatas({
  revisaoDup,
  marcadasParaApagar,
  currency,
  enviando,
  onFechar,
  onMarcarParaApagar,
  onImportarMesmoAssim,
}: {
  revisaoDup: LinhaAnalisada[] | null;
  marcadasParaApagar: Set<number>;
  currency: Currency;
  enviando: boolean;
  onFechar: () => void;
  onMarcarParaApagar: (id: number, marcar: boolean) => void;
  onImportarMesmoAssim: () => void;
}) {
  /** A linha cujo "Excluir o existente…" está à espera de confirmação. */
  const [aConfirmar, setAConfirmar] = useState<number | null>(null);

  function fechar() {
    setAConfirmar(null);
    onFechar();
  }

  return (
    <BottomSheet aberta={revisaoDup !== null} aoFechar={fechar} titulo="Isto já parece existir">
      <div className={styles.revisaoLista}>
        {revisaoDup?.map((l) => {
          const ex = l.duplicata.correspondencia!;
          const fixa = ex.origem === "despesaFixa";
          const marcada = marcadasParaApagar.has(l.id);
          return (
            <div key={l.id} className={styles.revisaoItem}>
              {/* O porquê, por cima dos dois lados: é o que diz onde olhar
                  ao comparar (a data? o valor? o nome?). */}
              {l.duplicata.motivos.length > 0 && (
                <p className={styles.revisaoMotivo}>
                  <TriangleAlert size={13} strokeWidth={2.5} aria-hidden />
                  {l.duplicata.motivos.join(", ")}
                </p>
              )}
              <div className={styles.revisaoLado}>
                <span className={styles.revisaoRotulo}>Novo no extrato</span>
                <span className={styles.revisaoDesc}>{l.descricao}</span>
                <span className={styles.revisaoMeta}>
                  {l.data.slice(8, 10)}/{l.data.slice(5, 7)} ·{" "}
                  <span className={styles.revisaoValor}>{formatMoney(l.valor, currency)}</span>
                </span>
              </div>
              <div className={`${styles.revisaoLado} ${styles.revisaoLadoExistente}`}>
                <span className={styles.revisaoRotulo}>Já registado</span>
                <span className={styles.revisaoDesc}>{descricaoExistente(ex, currency)}</span>
                <span className={styles.revisaoMeta}>
                  {ex.data.slice(8, 10)}/{ex.data.slice(5, 7)} ·{" "}
                  <span className={styles.revisaoValor}>
                    {formatMoney(Math.abs(ex.valor), currency)}
                  </span>
                </span>
              </div>

              <div className={styles.revisaoExcluir}>
                {marcada ? (
                  // Já confirmado: diz-se o que vai acontecer, e dá para voltar
                  // atrás antes de importar.
                  <>
                    <p className={styles.revisaoExcluirAviso}>
                      {fixa
                        ? "O mês desta despesa fixa vai voltar a ficar por pagar."
                        : "O lançamento já registado vai ser excluído."}
                    </p>
                    <button
                      type="button"
                      className={styles.linkBotao}
                      onClick={() => onMarcarParaApagar(l.id, false)}
                    >
                      Manter o existente
                    </button>
                  </>
                ) : aConfirmar === l.id ? (
                  <div
                    className={styles.revisaoConfirmar}
                    role="group"
                    aria-label="Confirmar exclusão"
                  >
                    <p>
                      {fixa
                        ? "Isto desmarca como pago o mês da despesa fixa que já está registado. Não dá para desfazer só por aqui."
                        : "Isto apaga o lançamento que já está registado. Não dá para desfazer só por aqui."}
                    </p>
                    <div className={styles.revisaoConfirmarAcoes}>
                      <button
                        type="button"
                        className={styles.botaoPerigo}
                        onClick={() => {
                          onMarcarParaApagar(l.id, true);
                          setAConfirmar(null);
                        }}
                      >
                        {fixa ? "Sim, desmarcar o mês" : "Sim, excluir o existente"}
                      </button>
                      <button
                        type="button"
                        className={styles.botao}
                        onClick={() => setAConfirmar(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.linkPerigo}
                    onClick={() => setAConfirmar(l.id)}
                  >
                    {fixa ? "Desmarcar o mês pago…" : "Excluir o existente…"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        className={styles.confirmar}
        disabled={enviando}
        onClick={() => {
          setAConfirmar(null);
          onImportarMesmoAssim();
        }}
      >
        Importar mesmo assim
      </button>
    </BottomSheet>
  );
}
