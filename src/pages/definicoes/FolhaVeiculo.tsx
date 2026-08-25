import BottomSheet from "../../components/BottomSheet";
import Seletor from "../../components/Seletor";
import { atualizarConfig } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import { TIPOS_VEICULO, rotuloTipoVeiculo } from "../../constants/veiculoPadrao";
import type { ConfigConta, TipoVeiculo } from "../../types";
import styles from "../Definicoes.module.css";

/** Tudo o que se CONFIGURA no módulo Veículo, num sítio só. A página Veículo
 *  passa a apenas refletir o que for escolhido aqui.
 *
 *  A motorização (item B1) vivia dentro da aba Abastecimentos da própria
 *  página Veículo, misturada com a lista de carregamentos — mas é escolha de
 *  uma vez, não conteúdo do mês: decide só que campos o formulário de
 *  abastecimento mostra (kWh, litros, ou os dois). */
export default function FolhaVeiculo({
  cfg,
  uid,
  aberta,
  aoFechar,
}: {
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  async function mudarTipo(valor: string) {
    if (valor === cfg.tipoVeiculo) return;
    try {
      await atualizarConfig(uid, { tipoVeiculo: valor as TipoVeiculo });
      mostrarToast("✓ Tipo de veículo atualizado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Veículo">
      <p className={styles.nota}>
        A motorização decide o que o registo de abastecimento pergunta: elétrico só kWh, combustão
        só litros, híbrido os dois (um abastecimento de cada vez).
      </p>
      <div className={styles.linhaSelect}>
        <span>Tipo de veículo</span>
        <Seletor
          variante="inline"
          rotulo="Tipo de veículo"
          nivel={1}
          valor={cfg.tipoVeiculo}
          opcoes={TIPOS_VEICULO.map((t) => t.valor)}
          rotuloOpcao={(v) => rotuloTipoVeiculo(v as TipoVeiculo)}
          aoMudar={(v) => void mudarTipo(v)}
        />
      </div>
    </BottomSheet>
  );
}
