import { SEGMENTOS, type StatusLinha } from "./agrupamento";
import type { FiltroImportacao } from "./constantes";
import styles from "../Importar.module.css";

const COR_SEGMENTO: Record<StatusLinha, string> = {
  atencao: styles.segAtencao,
  duplicata: styles.segDuplicata,
  novo: styles.segNovo,
  pronto: styles.segPronto,
};

/** "N revisar · N duplicatas · N novos · N prontos": o resumo do topo é
 *  também o filtro da lista. Cada segmento é um botão que liga/desliga
 *  (`aria-pressed`); escolher o que já está escolhido volta a mostrar tudo.
 *  Por baixo, uma barra fina com a proporção de cada estado. */
export default function ImportacaoFiltros({
  contagem,
  filtro,
  setFiltro,
}: {
  contagem: Record<StatusLinha, number>;
  filtro: FiltroImportacao;
  setFiltro: (filtro: FiltroImportacao) => void;
}) {
  const total = SEGMENTOS.reduce((s, g) => s + contagem[g.id], 0);
  return (
    <div className={styles.segmentos}>
      <div className={styles.segmentosBotoes} role="group" aria-label="Filtrar linhas por estado">
        {SEGMENTOS.map((g, i) => {
          const n = contagem[g.id];
          const ativo = filtro === g.id;
          return (
            <span key={g.id} className={styles.segmentoItem}>
              {i > 0 && (
                <span className={styles.segmentoSep} aria-hidden>
                  ·
                </span>
              )}
              <button
                type="button"
                className={`${styles.segmento} ${ativo ? styles.segmentoAtivo : ""}`}
                aria-pressed={ativo}
                disabled={n === 0 && !ativo}
                onClick={() => setFiltro(ativo ? "todas" : g.id)}
              >
                <span className={`${styles.segmentoPonto} ${COR_SEGMENTO[g.id]}`} aria-hidden />
                <span className={styles.segmentoNumero}>{n}</span> {g.rotulo(n)}
              </button>
            </span>
          );
        })}
      </div>
      {total > 0 && (
        <div className={styles.segmentosBarra} aria-hidden>
          {SEGMENTOS.filter((g) => contagem[g.id] > 0).map((g) => (
            <span key={g.id} className={COR_SEGMENTO[g.id]} style={{ flexGrow: contagem[g.id] }} />
          ))}
        </div>
      )}
    </div>
  );
}
