import { memo } from "react";
import { formatMoney } from "../../utils/money";
import type { Currency, LinhaAnalisada } from "../../types";
import { pendenciasDaLinha, type StatusLinha } from "./agrupamento";
import { descricaoExistente } from "./constantes";
import styles from "../Importar.module.css";

/** Uma linha do extrato na lista da revisão, compacta (~52px): caixa de
 *  marcar, descrição cortada, data e valor. O que falta aparece por baixo, em
 *  letra pequena — vermelho quando trava a importação, amarelo quando é só
 *  aviso. Tocar na linha seleciona-a (desktop: abre no editor ao lado;
 *  telemóvel: abre por baixo dela). A edição em si vive em `EditorLinha`. */
function LinhaImportacao({
  l,
  currency,
  temContas,
  status,
  selecionada,
  modo,
  idEditor,
  aoSelecionar,
  aoMudar,
}: {
  l: LinhaAnalisada;
  currency: Currency;
  /** Há conta cadastrada — sem nenhuma, a linha não pede conta. */
  temContas: boolean;
  /** O grupo onde a linha está a ser mostrada (pode estar "congelado" —
   *  ver `RevisaoImportacao`). Vai de volta em `aoMudar`. */
  status: StatusLinha;
  selecionada: boolean;
  /** "detalhe" = lista + editor ao lado (desktop); "inline" = abre por baixo. */
  modo: "detalhe" | "inline";
  idEditor: string;
  aoSelecionar: (id: number) => void;
  aoMudar: (id: number, mudancas: Partial<LinhaAnalisada>, status: StatusLinha) => void;
}) {
  const pendencias = pendenciasDaLinha(l, temContas);
  const dup =
    pendencias.length === 0 && l.duplicata.status !== "new" && l.duplicata.correspondencia
      ? l.duplicata.correspondencia
      : null;

  return (
    <div
      className={`${styles.linha} ${selecionada ? styles.linhaSelecionada : ""} ${
        l.acao === "import" ? "" : styles.linhaDeFora
      }`}
    >
      <label className={styles.linhaAcao}>
        <input
          type="checkbox"
          // Sem texto ao lado, a caixa não tinha nome: o leitor de tela dizia
          // só "caixa de seleção, marcada", sem dizer de que linha.
          aria-label={`Importar ${l.descricao}`}
          checked={l.acao === "import"}
          onChange={(e) => aoMudar(l.id, { acao: e.target.checked ? "import" : "skip" }, status)}
        />
      </label>
      <button
        type="button"
        className={styles.linhaBotao}
        onClick={() => aoSelecionar(l.id)}
        aria-expanded={modo === "inline" ? selecionada : undefined}
        aria-pressed={modo === "detalhe" ? selecionada : undefined}
        aria-controls={selecionada ? idEditor : undefined}
      >
        <span className={styles.linhaTopo}>
          <span className={styles.linhaDescricao}>{l.descricao}</span>
          <span className={styles.linhaData}>
            {l.data.slice(8, 10)}/{l.data.slice(5, 7)}
          </span>
          <span className={l.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}>
            {formatMoney(l.valor, currency)}
          </span>
        </span>
        {pendencias.length > 0 ? (
          <span className={styles.pendencias}>
            {pendencias.map((p, i) => (
              <span
                key={p.campo}
                className={p.bloqueia ? styles.pendenciaErro : styles.pendenciaAviso}
              >
                {i > 0 && " · "}
                {p.curta}
              </span>
            ))}
          </span>
        ) : dup ? (
          <span className={styles.pendenciaDup}>
            Já registado: {descricaoExistente(dup, currency)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/** `memo`: editar uma linha só re-renderiza essa linha. Funciona porque as
 *  outras linhas mantêm a mesma identidade (`atualizarLinha` só recria o
 *  objeto alterado) e todos os outros props são primitivos ou estáveis entre
 *  renders (`aoSelecionar`/`aoMudar` são `useCallback` em `RevisaoImportacao`). */
export default memo(LinhaImportacao);
