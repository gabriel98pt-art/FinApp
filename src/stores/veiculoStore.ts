import { criarStoreEspelho } from "./storeEspelho";
import type { DadosVeiculo } from "../types";
import { VEICULO_VAZIO } from "../constants/veiculoPadrao";

/** Espelho do veículo — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
export const useVeiculoStore = criarStoreEspelho<{
  dados: DadosVeiculo;
  carregado: boolean;
  erro: boolean;
}>("finapp-veiculo", { dados: VEICULO_VAZIO, carregado: false, erro: false });
