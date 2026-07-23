// Liga as subscrições do RTDB às stores por domínio. Vive junto da sessão:
// inicia no login (useSyncConta) e limpa tudo no logout.

import { observarConfig } from "./cfgService";
import { observarDespesas, observarParcelas, observarReceitas } from "./lancamentosService";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";

export function iniciarSyncConta(uid: string): () => void {
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

  return () => {
    paraReceitas();
    paraDespesas();
    paraParcelas();
    paraCfg();
    // Nunca deixar dados de uma conta visíveis para a próxima (seção 4.9)
    useReceitasStore.setState({ itens: [], carregado: false });
    useDespesasStore.setState({ itens: [], carregado: false });
    useParcelasStore.setState({ itens: [], carregado: false });
    useCfgStore.setState({ cfg: CONFIG_PADRAO, carregado: false });
  };
}
