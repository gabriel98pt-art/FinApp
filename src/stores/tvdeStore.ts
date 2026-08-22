import { criarStoreEspelho } from "./storeEspelho";
import type { DadosTvde } from "../types";
import { TVDE_VAZIO } from "../constants/tvdePadrao";

/** Espelho do módulo TVDE — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
export const useTvdeStore = criarStoreEspelho<{
  dados: DadosTvde;
  carregado: boolean;
  erro: boolean;
}>("finapp-tvde", { dados: TVDE_VAZIO, carregado: false, erro: false });
