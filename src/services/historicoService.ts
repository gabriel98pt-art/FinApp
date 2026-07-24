// Captura/restauração de estado pro undo/redo (seção 4.7).
//
// A captura NÃO vai à rede: lê as stores zustand já sincronizadas em memória
// pelo syncService — exatamente como a origem fazia JSON.stringify(S) sobre
// o objeto global em memória, sem custo de leitura no Firebase a cada ação.
// A restauração sobrescreve a árvore inteira (mesma operação que
// importarBackup); as stores se atualizam sozinhas via os listeners do
// syncService assim que o Firebase confirma a escrita.

import { ref, set } from "firebase/database";
import { db } from "./firebase";
import { useCfgStore } from "../stores/cfgStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useVeiculoStore } from "../stores/veiculoStore";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

/** Lista normalizada [{id,...}] → mapa {id: {...sem id}} — formato que o
 *  RTDB (e o resto dos domínios) espera ao escrever a árvore de volta. */
function paraMapa<T extends { id: string }>(itens: T[]): Record<string, Omit<T, "id">> {
  const mapa: Record<string, Omit<T, "id">> = {};
  for (const { id, ...resto } of itens) mapa[id] = resto;
  return mapa;
}

/** Serializa o estado atual da conta — equivalente ao JSON.stringify(S) da
 *  origem, mas lendo das stores em memória em vez de um objeto global único. */
export function capturarEstadoAtual(): string {
  const veiculo = useVeiculoStore.getState().dados;
  const arvore = {
    receitas: paraMapa(useReceitasStore.getState().itens),
    despesasCorrentes: paraMapa(useDespesasStore.getState().itens),
    parcelas: paraMapa(useParcelasStore.getState().itens),
    veiculo: {
      cargas: paraMapa(veiculo.cargas),
      despesas: paraMapa(veiculo.despesas),
      despesasFixas: paraMapa(veiculo.despesasFixas),
      quilometragem: paraMapa(veiculo.quilometragem),
    },
    eventos: paraMapa(useEventosStore.getState().itens),
    fundos: paraMapa(useFundosStore.getState().itens),
    cfg: useCfgStore.getState().cfg,
    tvde: useTvdeStore.getState().dados,
  };
  return JSON.stringify(arvore);
}

/** Sobrescreve a árvore inteira da conta com um estado capturado antes. */
export async function restaurarEstado(uid: string, estadoSerializado: string): Promise<void> {
  const arvore = JSON.parse(estadoSerializado);
  await set(ref(db, raiz(uid)), arvore);
}
