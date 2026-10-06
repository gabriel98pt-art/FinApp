import { useAbasTeclado } from "../../hooks/useAbasTeclado";
import { idAba, idPainelAba } from "../../utils/abas";
import type { LinhaAnalisada } from "../../types";
import { FILTROS, type FiltroImportacao } from "./constantes";
import styles from "../Importar.module.css";

/** As abas de filtro por decisão (com contagem), no padrão ARIA de abas. */
export default function ImportacaoFiltros({
  linhas,
  filtro,
  setFiltro,
}: {
  linhas: LinhaAnalisada[];
  filtro: FiltroImportacao;
  setFiltro: (filtro: FiltroImportacao) => void;
}) {
  const { propsLista, propsAba } = useAbasTeclado({
    abas: FILTROS.map((f) => f.id),
    atual: filtro,
    aoMudar: setFiltro,
  });

  return (
    <div className={styles.filtros} role="tablist" {...propsLista}>
      {FILTROS.map((f) => (
        <button
          key={f.id}
          role="tab"
          id={idAba(f.id)}
          aria-selected={filtro === f.id}
          // Variante de painel único: ao contrário de Despesas ou
          // Veículo, aqui não há um painel por separador — é sempre a
          // mesma lista, filtrada. Os três separadores apontam para ela,
          // e é ela que muda de rótulo conforme o que está seleccionado.
          aria-controls={idPainelAba("linhas")}
          {...propsAba(f.id)}
          className={`${styles.filtroBotao} ${filtro === f.id ? styles.filtroAtivo : ""}`}
          onClick={() => setFiltro(f.id)}
        >
          {f.rotulo}
          {f.id !== "todas" && ` (${linhas.filter((l) => l.decisao === f.id).length})`}
        </button>
      ))}
    </div>
  );
}
