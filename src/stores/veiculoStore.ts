import { create } from "zustand";
import type { DadosVeiculo } from "../types";
import { VEICULO_VAZIO } from "../services/veiculoService";

/** Espelho do veículo — alimentado só pelo syncService. */
interface VeiculoState {
  dados: DadosVeiculo;
  carregado: boolean;
}

export const useVeiculoStore = create<VeiculoState>(() => ({
  dados: VEICULO_VAZIO,
  carregado: false,
}));
