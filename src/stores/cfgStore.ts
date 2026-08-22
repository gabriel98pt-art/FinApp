import { criarStoreEspelho } from "./storeEspelho";
import type { ConfigConta } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

/** Espelho da config da conta — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1): RTDB sincroniza por WebSocket, que o service
 *  worker não consegue interceptar/cachear — sem isso, um reload offline
 *  ficaria preso em "carregando" para sempre em vez de mostrar o último
 *  sync. O reset de logout (syncService) grava por cima, então não vaza
 *  dados de uma conta pra outra (seção 4.9). */
export const useCfgStore = criarStoreEspelho<{
  cfg: ConfigConta;
  carregado: boolean;
  erro: boolean;
}>("finapp-cfg", { cfg: CONFIG_PADRAO, carregado: false, erro: false });
