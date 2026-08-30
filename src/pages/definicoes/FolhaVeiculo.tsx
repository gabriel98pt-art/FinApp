import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import Seletor from "../../components/Seletor";
import SettingsRow from "../../components/settings/SettingsRow";
import SettingsSwitchRow from "../../components/settings/SettingsSwitchRow";
import SeletorCor from "../../components/SeletorCor";
import SeletorIcone from "../../components/SeletorIcone";
import {
  atualizarConfig,
  definirCorCategoria,
  definirIconeCategoria,
} from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import { corDaCategoriaVisual, iconeDaCategoria } from "../../utils/categoriaVisual";
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
  const [corAberta, setCorAberta] = useState(false);
  const [iconeAberto, setIconeAberto] = useState(false);

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
  // domínios do módulo, não algo que se lance) — chegou a aparecer, sem poder
  // ser removida nem renomeada, dentro da folha de "Categorias de despesa"
  // (só a cor era editável ali). Ajuste E do lote de 30/08: saiu de lá,
  // repetida com este controle — mora só aqui agora, junto do resto do
  // módulo. O dado é o mesmo de sempre: `cfg.categoriaCor["Veículo"]`, que a
  // cor do botão flutuante também usa.
  async function escolherCor(cor: string | null) {
    setCorAberta(false);
    try {
      await definirCorCategoria(uid, "Veículo", cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  // Ajuste F do lote de 30/08: despesas do veículo deixaram de pedir
  // categoria — viraram nome livre, com UM ícone só (e a mesma cor acima)
  // valendo pra todas, escolhido aqui de uma vez. Carga/abastecimento
  // continuam de fora: o ícone deles é fixo (tomada/bomba, item 7),
  // condicional ao tipo do veículo, não este aqui.
  async function escolherIcone(icone: string | null) {
    setIconeAberto(false);
    try {
      await definirIconeCategoria(uid, "Veículo", icone);
    } catch {
      mostrarToast("Não foi possível salvar o ícone.");
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
          <SettingsRow
            titulo="Cor do Veículo"
            valor={cfg.categoriaCor?.["Veículo"] ? "Personalizada" : "Padrão"}
            navegavel
            onClick={() => setCorAberta(true)}
          />
          {/* Ajuste F: só o ícone das despesas do veículo — carga/abastecimento
              já tem o seu próprio, fixo (item 7), sem controle aqui. */}
          <SettingsRow
            titulo="Ícone das despesas"
            valor={iconeDaCategoria(cfg, "Veículo") ? "Escolhido" : "Padrão"}
            navegavel
            onClick={() => setIconeAberto(true)}
          />
        </>
      )}

      <SeletorCor
        aberta={corAberta}
        aoFechar={() => setCorAberta(false)}
        titulo="Cor do Veículo"
        valor={corDaCategoriaVisual(cfg, "Veículo")}
        // Mesmo aviso do editor geral de categorias: Veículo é uma fatia do
        // mesmo donut de despesas, então repetir a cor de uma delas por
        // engano confunde do mesmo jeito.
        coresEmUso={cfg.categoriasDespesa.map((c) => corDaCategoriaVisual(cfg, c))}
        aoEscolher={(c) => void escolherCor(c)}
        nivel={1}
      />
      <SeletorIcone
        aberta={iconeAberto}
        aoFechar={() => setIconeAberto(false)}
        titulo="Ícone das despesas do veículo"
        valor={iconeDaCategoria(cfg, "Veículo")}
        aoEscolher={(i) => void escolherIcone(i)}
        nivel={1}
      />
    </BottomSheet>
  );
}
