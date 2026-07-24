import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConfigConta } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

/** Espelho da config da conta — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1): RTDB sincroniza por WebSocket, que o service
 *  worker não consegue interceptar/cachear — sem isso, um reload offline
 *  ficaria preso em "carregando" para sempre em vez de mostrar o último
 *  sync. O reset de logout (syncService) grava por cima, então não vaza
 *  dados de uma conta pra outra (seção 4.9). */
interface CfgState {
  cfg: ConfigConta;
  carregado: boolean;
}

export const useCfgStore = create<CfgState>()(
  persist(
    (): CfgState => ({
      cfg: CONFIG_PADRAO,
      carregado: false,
    }),
    { name: "finapp-cfg" },
  ),
);
