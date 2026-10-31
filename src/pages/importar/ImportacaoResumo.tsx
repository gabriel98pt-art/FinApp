import type { LinhaAnalisada } from "../../types";
import { contarStatus } from "./agrupamento";
import type { FiltroImportacao } from "./constantes";
import ImportacaoFiltros from "./ImportacaoFiltros";
import styles from "../Importar.module.css";
import Botao from "../../components/Botao";

/** Topo da revisão: o resumo por estado (que também filtra a lista) e
 *  "Novo extrato". */
export default function ImportacaoResumo({
  linhas,
  temContas,
  filtro,
  setFiltro,
  onNovoExtrato,
}: {
  linhas: LinhaAnalisada[];
  temContas: boolean;
  filtro: FiltroImportacao;
  setFiltro: (filtro: FiltroImportacao) => void;
  onNovoExtrato: () => void;
}) {
  return (
    <div className={styles.resumo}>
      <ImportacaoFiltros
        contagem={contarStatus(linhas, temContas)}
        filtro={filtro}
        setFiltro={setFiltro}
      />
      <Botao variante="link" onClick={onNovoExtrato}>
        Novo extrato
      </Botao>
    </div>
  );
}
