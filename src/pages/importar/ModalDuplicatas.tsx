import { TriangleAlert } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { formatMoney } from "../../utils/money";
import type { Currency, LinhaAnalisada } from "../../types";
import styles from "../Importar.module.css";

/** Revisão antes de gravar: o que vai entrar, ao lado do que já existe e
 *  se parece com isso. A importação acontece de qualquer maneira — o que
 *  se decide aqui é só se o registo ANTIGO também sai. Desligado por
 *  omissão: a pontuação de duplicata é palpite, e apagar por engano um
 *  lançamento verdadeiro é pior do que ficar com um repetido. */
export default function ModalDuplicatas({
  revisaoDup,
  marcadasParaApagar,
  currency,
  enviando,
  totalImportar,
  onFechar,
  onMarcarParaApagar,
  onImportarMesmoAssim,
}: {
  revisaoDup: LinhaAnalisada[] | null;
  marcadasParaApagar: Set<number>;
  currency: Currency;
  enviando: boolean;
  totalImportar: number;
  onFechar: () => void;
  onMarcarParaApagar: (id: number, marcar: boolean) => void;
  onImportarMesmoAssim: () => void;
}) {
  return (
    <BottomSheet aberta={revisaoDup !== null} aoFechar={onFechar} titulo="Isto já parece existir">
      <div className={styles.revisaoLista}>
        {revisaoDup?.map((l) => {
          const ex = l.duplicata.correspondencia!;
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
                <span className={styles.revisaoRotulo}>A importar</span>
                <span className={styles.revisaoDesc}>{l.descricao}</span>
                <span className={styles.revisaoMeta}>
                  {l.data.slice(8, 10)}/{l.data.slice(5, 7)} ·{" "}
                  <span className={styles.revisaoValor}>{formatMoney(l.valor, currency)}</span>
                </span>
              </div>
              <div className={`${styles.revisaoLado} ${styles.revisaoLadoExistente}`}>
                <span className={styles.revisaoRotulo}>Já registado</span>
                <span className={styles.revisaoDesc}>
                  {ex.origem === "carga" ? `Carga elétrica em ${ex.descricao}` : ex.descricao}
                </span>
                <span className={styles.revisaoMeta}>
                  {ex.data.slice(8, 10)}/{ex.data.slice(5, 7)} ·{" "}
                  <span className={styles.revisaoValor}>{formatMoney(ex.valor, currency)}</span>
                </span>
              </div>
              <label className={styles.revisaoApagar}>
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={(e) => onMarcarParaApagar(l.id, e.target.checked)}
                />
                {ex.origem === "despesaFixa"
                  ? "também desmarcar esse mês como pago"
                  : "também apagar o registo existente"}
              </label>
            </div>
          );
        })}
      </div>
      <button className={styles.confirmar} disabled={enviando} onClick={onImportarMesmoAssim}>
        {enviando ? "Aguarde…" : `Importar mesmo assim (${totalImportar})`}
      </button>
    </BottomSheet>
  );
}
