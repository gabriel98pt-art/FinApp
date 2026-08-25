import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import Seletor from "../../components/Seletor";
import SettingsRow from "../../components/settings/SettingsRow";
import SettingsSwitchRow from "../../components/settings/SettingsSwitchRow";
import SeletorCor from "../../components/SeletorCor";
import FolhaCategorias from "./FolhaCategorias";
import { atualizarConfig, definirCorCategoria } from "../../services/cfgService";
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
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [corAberta, setCorAberta] = useState(false);

  /** Ligar/desligar o módulo inteiro. Mora aqui dentro, e não solto em
   *  Definições ao lado do Módulo TVDE, porque este é o sítio onde já vive
   *  tudo o que diz respeito ao Veículo — o interruptor é a primeira decisão
   *  desta folha, não mais um item numa lista geral. */
  async function alternarModulo() {
    try {
      await atualizarConfig(uid, { showVeiculo: !cfg.showVeiculo });
      mostrarToast(cfg.showVeiculo ? "Módulo Veículo desligado" : "✓ Módulo Veículo ligado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  async function mudarTipo(valor: string) {
    if (valor === cfg.tipoVeiculo) return;
    try {
      await atualizarConfig(uid, { tipoVeiculo: valor as TipoVeiculo });
      mostrarToast("✓ Tipo de veículo atualizado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  // "Veículo" não é uma categoria de `cfg.categoriasDespesa` (é o resumo dos 4
  // domínios do módulo, não algo que se lance), por isso nunca apareceu na
  // folha de categorias para ser recolorido. O dado já existia — a cor do
  // botão flutuante usa o mesmo `cfg.categoriaCor["Veículo"]` — e o que muda
  // aqui é só onde se mexe nele: com o resto do módulo, e não solto em
  // Aparência entre coisas do app inteiro.
  async function escolherCor(cor: string | null) {
    setCorAberta(false);
    try {
      await definirCorCategoria(uid, "Veículo", cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Veículo">
      <SettingsSwitchRow
        titulo="Módulo Veículo"
        checked={cfg.showVeiculo}
        onChange={() => void alternarModulo()}
      />
      <p className={styles.nota}>
        Desligado, o Veículo sai da navegação e do registro rápido. Nada é apagado: voltar a ligar
        devolve tudo como estava.
      </p>

      {/* Com o módulo desligado, o resto desta folha é configuração de algo que
          não aparece em lado nenhum — só o interruptor fica. */}
      {cfg.showVeiculo && (
        <>
          <p className={styles.nota}>
            A motorização decide o que o registo de abastecimento pergunta: elétrico só kWh,
            combustão só litros, híbrido os dois (um abastecimento de cada vez).
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
          {/* Mesmo editor das categorias de despesa gerais — é a mesma coisa, só
              noutra lista. De caminho ganha o que a versão de chips na página
              Veículo nunca teve: ícone e cor por categoria. */}
          <SettingsRow
            titulo="Categorias de despesa"
            valor={`${cfg.categoriasVeiculo.length} ativas`}
            navegavel
            onClick={() => setCategoriasAberto(true)}
          />
          <SettingsRow
            titulo="Cor do Veículo"
            valor={cfg.categoriaCor?.["Veículo"] ? "Personalizada" : "Padrão"}
            navegavel
            onClick={() => setCorAberta(true)}
          />
        </>
      )}

      <FolhaCategorias
        titulo="Categorias do veículo"
        itens={cfg.categoriasVeiculo}
        lista="categoriasVeiculo"
        cfg={cfg}
        uid={uid}
        aberta={categoriasAberto}
        nivel={1}
        aoFechar={() => setCategoriasAberto(false)}
      />
      <SeletorCor
        aberta={corAberta}
        aoFechar={() => setCorAberta(false)}
        titulo="Cor do Veículo"
        valor={cfg.categoriaCor?.["Veículo"] ?? ""}
        aoEscolher={(c) => void escolherCor(c)}
        nivel={1}
      />
    </BottomSheet>
  );
}
