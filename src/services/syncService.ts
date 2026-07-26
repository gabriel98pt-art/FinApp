// Liga as subscrições do RTDB às stores por domínio. Vive junto da sessão:
// inicia no login (useSyncConta) e limpa tudo no logout.
//
// Cada subscrição tem dois destinos: sucesso grava os dados e limpa `erro`
// (se a ligação voltar sozinha, o aviso some); erro marca `erro: true` e
// `carregado: true` — sair do "Carregando…" é o ponto, senão a tela espera
// para sempre. O que já tinha sido carregado NÃO é apagado: continua válido,
// só deixou de ser atualizado.

import { observarConfig } from "./cfgService";
import { observarEventos } from "./eventosService";
import { observarFundos } from "./fundosService";
import {
  observarDespesas,
  observarDespesasFixas,
  observarParcelas,
  observarReceitas,
  observarTransferencias,
} from "./lancamentosService";
import { observarTvde, TVDE_VAZIO } from "./tvdeService";
import { observarVeiculo, VEICULO_VAZIO } from "./veiculoService";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import { useHistoricoStore } from "../stores/historicoStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useVeiculoStore } from "../stores/veiculoStore";

/** Store mínima que este módulo precisa de tocar em caso de erro. */
type StoreSincronizada = {
  setState: (parcial: { carregado: boolean; erro: boolean }) => void;
};

/** Marca a queda sem tocar nos dados já carregados. */
const marcarErro = (store: StoreSincronizada) => () =>
  store.setState({ carregado: true, erro: true });

export function iniciarSyncConta(uid: string): () => void {
  useHistoricoStore.getState().iniciar(uid);

  const paraReceitas = observarReceitas(
    uid,
    (itens) => useReceitasStore.setState({ itens, carregado: true, erro: false }),
    marcarErro(useReceitasStore),
  );
  const paraDespesas = observarDespesas(
    uid,
    (itens) => useDespesasStore.setState({ itens, carregado: true, erro: false }),
    marcarErro(useDespesasStore),
  );
  const paraParcelas = observarParcelas(
    uid,
    (itens) =>
      useParcelasStore.setState({
        // RTDB omite mapas vazios — pagoPorMes precisa existir sempre
        itens: itens.map((p) => ({ ...p, pagoPorMes: p.pagoPorMes ?? {} })),
        carregado: true,
        erro: false,
      }),
    marcarErro(useParcelasStore),
  );
  const paraCfg = observarConfig(
    uid,
    (cfg) => useCfgStore.setState({ cfg, carregado: true, erro: false }),
    marcarErro(useCfgStore),
  );
  const paraTvde = observarTvde(
    uid,
    (dados) => useTvdeStore.setState({ dados, carregado: true, erro: false }),
    marcarErro(useTvdeStore),
  );
  const paraVeiculo = observarVeiculo(
    uid,
    (dados) => useVeiculoStore.setState({ dados, carregado: true, erro: false }),
    marcarErro(useVeiculoStore),
  );
  const paraEventos = observarEventos(
    uid,
    (itens) => useEventosStore.setState({ itens, carregado: true, erro: false }),
    marcarErro(useEventosStore),
  );
  const paraFundos = observarFundos(
    uid,
    (itens) => useFundosStore.setState({ itens, carregado: true, erro: false }),
    marcarErro(useFundosStore),
  );
  const paraDespesasFixas = observarDespesasFixas(
    uid,
    (itens) =>
      useDespesasFixasStore.setState({
        // RTDB omite mapas vazios — pagoPorMes precisa existir sempre
        itens: itens.map((f) => ({ ...f, pagoPorMes: f.pagoPorMes ?? {} })),
        carregado: true,
        erro: false,
      }),
    marcarErro(useDespesasFixasStore),
  );
  const paraTransferencias = observarTransferencias(
    uid,
    (itens) => useTransferenciasStore.setState({ itens, carregado: true, erro: false }),
    marcarErro(useTransferenciasStore),
  );

  return () => {
    paraReceitas();
    paraDespesas();
    paraParcelas();
    paraCfg();
    paraTvde();
    paraVeiculo();
    paraEventos();
    paraFundos();
    paraDespesasFixas();
    paraTransferencias();
    // Nunca deixar dados de uma conta visíveis para a próxima (seção 4.9).
    // `erro` volta a false junto: é estado da subscrição que acabou de morrer.
    useReceitasStore.setState({ itens: [], carregado: false, erro: false });
    useDespesasStore.setState({ itens: [], carregado: false, erro: false });
    useParcelasStore.setState({ itens: [], carregado: false, erro: false });
    useCfgStore.setState({ cfg: CONFIG_PADRAO, carregado: false, erro: false });
    useTvdeStore.setState({ dados: TVDE_VAZIO, carregado: false, erro: false });
    useVeiculoStore.setState({ dados: VEICULO_VAZIO, carregado: false, erro: false });
    useEventosStore.setState({ itens: [], carregado: false, erro: false });
    useFundosStore.setState({ itens: [], carregado: false, erro: false });
    useDespesasFixasStore.setState({ itens: [], carregado: false, erro: false });
    useTransferenciasStore.setState({ itens: [], carregado: false, erro: false });
    useHistoricoStore.getState().parar();
  };
}
