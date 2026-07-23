// Liga as subscrições do RTDB às stores por domínio. Vive junto da sessão:
// inicia no login (useSyncConta) e limpa tudo no logout.

import { observarDespesas, observarReceitas } from "./lancamentosService";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";

export function iniciarSyncConta(uid: string): () => void {
  const paraReceitas = observarReceitas(uid, (itens) =>
    useReceitasStore.setState({ itens, carregado: true }),
  );
  const paraDespesas = observarDespesas(uid, (itens) =>
    useDespesasStore.setState({ itens, carregado: true }),
  );

  return () => {
    paraReceitas();
    paraDespesas();
    // Nunca deixar dados de uma conta visíveis para a próxima (seção 4.9)
    useReceitasStore.setState({ itens: [], carregado: false });
    useDespesasStore.setState({ itens: [], carregado: false });
  };
}
