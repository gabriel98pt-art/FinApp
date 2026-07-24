// Liga as subscrições do RTDB às stores por domínio. Vive junto da sessão:
// inicia no login (useSyncConta) e limpa tudo no logout.

import { observarConfig } from "./cfgService";
import { observarEventos } from "./eventosService";
import { observarFundos } from "./fundosService";
import { observarDespesas, observarParcelas, observarReceitas } from "./lancamentosService";
import { observarTvde, TVDE_VAZIO } from "./tvdeService";
import { observarVeiculo, VEICULO_VAZIO } from "./veiculoService";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import { useHistoricoStore } from "../stores/historicoStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useVeiculoStore } from "../stores/veiculoStore";

export function iniciarSyncConta(uid: string): () => void {
  useHistoricoStore.getState().iniciar(uid);

  const paraReceitas = observarReceitas(uid, (itens) =>
    useReceitasStore.setState({ itens, carregado: true }),
  );
  const paraDespesas = observarDespesas(uid, (itens) =>
    useDespesasStore.setState({ itens, carregado: true }),
  );
  const paraParcelas = observarParcelas(uid, (itens) =>
    useParcelasStore.setState({
      // RTDB omite mapas vazios — pagoPorMes precisa existir sempre
      itens: itens.map((p) => ({ ...p, pagoPorMes: p.pagoPorMes ?? {} })),
      carregado: true,
    }),
  );
  const paraCfg = observarConfig(uid, (cfg) => useCfgStore.setState({ cfg, carregado: true }));
  const paraTvde = observarTvde(uid, (dados) => useTvdeStore.setState({ dados, carregado: true }));
  const paraVeiculo = observarVeiculo(uid, (dados) =>
    useVeiculoStore.setState({ dados, carregado: true }),
  );
  const paraEventos = observarEventos(uid, (itens) =>
    useEventosStore.setState({ itens, carregado: true }),
  );
  const paraFundos = observarFundos(uid, (itens) =>
    useFundosStore.setState({ itens, carregado: true }),
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
    // Nunca deixar dados de uma conta visíveis para a próxima (seção 4.9)
    useReceitasStore.setState({ itens: [], carregado: false });
    useDespesasStore.setState({ itens: [], carregado: false });
    useParcelasStore.setState({ itens: [], carregado: false });
    useCfgStore.setState({ cfg: CONFIG_PADRAO, carregado: false });
    useTvdeStore.setState({ dados: TVDE_VAZIO, carregado: false });
    useVeiculoStore.setState({ dados: VEICULO_VAZIO, carregado: false });
    useEventosStore.setState({ itens: [], carregado: false });
    useFundosStore.setState({ itens: [], carregado: false });
    useHistoricoStore.getState().parar();
  };
}
