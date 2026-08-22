import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";
import type { DadosVeiculo } from "../types";
import { VEICULO_VAZIO } from "../constants/veiculoPadrao";

/** Espelho do veículo — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface VeiculoState {
  dados: DadosVeiculo;
  carregado: boolean;
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: VeiculoState) => ({ dados: s.dados, carregado: s.carregado });

export const useVeiculoStore = create<VeiculoState>()(
  persist(
    (): VeiculoState => ({
      dados: VEICULO_VAZIO,
      carregado: false,
      erro: false,
    }),
    { name: "finapp-veiculo", partialize: semErro, storage: persistenciaAdiada },
  ),
);
