import { idAba, idPainelAba } from "../../utils/abas";
import type { Abastecimento, ConfigConta, LinhaAnalisada } from "../../types";
import type { FiltroImportacao } from "./constantes";
import LinhaImportacao from "./LinhaImportacao";
import styles from "../Importar.module.css";

/** O painel (único) das abas de filtro: as linhas visíveis, uma
 *  `LinhaImportacao` por item. */
export default function ListaLinhasImportacao({
  visiveis,
  filtro,
  cfg,
  cargasVeiculo,
  opcoesCategoria,
  opcoesFonte,
  cartoesCredito,
  outraPontaAberta,
  atualizarLinha,
  alternarOutraPonta,
}: {
  visiveis: LinhaAnalisada[];
  filtro: FiltroImportacao;
  cfg: ConfigConta;
  cargasVeiculo: Abastecimento[];
  opcoesCategoria: string[];
  opcoesFonte: string[];
  cartoesCredito: string[];
  outraPontaAberta: Set<number>;
  atualizarLinha: (id: number, mudancas: Partial<LinhaAnalisada>) => void;
  alternarOutraPonta: (id: number) => void;
}) {
  return (
    <div
      className={styles.lista}
      role="tabpanel"
      id={idPainelAba("linhas")}
      aria-labelledby={idAba(filtro)}
    >
      {visiveis.map((l) => (
        <LinhaImportacao
          key={l.id}
          l={l}
          cfg={cfg}
          cargasVeiculo={cargasVeiculo}
          opcoesCategoria={opcoesCategoria}
          opcoesFonte={opcoesFonte}
          cartoesCredito={cartoesCredito}
          outraPontaAberta={outraPontaAberta.has(l.id)}
          atualizarLinha={atualizarLinha}
          alternarOutraPonta={alternarOutraPonta}
        />
      ))}
    </div>
  );
}
