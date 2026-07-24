import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DadosVeiculo } from "../types";
import { VEICULO_VAZIO } from "../services/veiculoService";

/** Espelho do veículo — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface VeiculoState {
  dados: DadosVeiculo;
  carregado: boolean;
}

export const useVeiculoStore = create<VeiculoState>()(
  persist(
    (): VeiculoState => ({
      dados: VEICULO_VAZIO,
      carregado: false,
    }),
    { name: "finapp-veiculo" },
  ),
);
