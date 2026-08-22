import type { DadosVeiculo } from "../types";

// Extraído de veiculoService.ts (mesmo motivo de tvdePadrao.ts): quebra o
// ciclo stores/veiculoStore.ts → services/veiculoService.ts → ... →
// stores/veiculoStore.ts. veiculoService.ts continua a exportá-la.

export const VEICULO_VAZIO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};
