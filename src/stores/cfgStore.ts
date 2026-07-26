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
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: CfgState) => ({ cfg: s.cfg, carregado: s.carregado });

export const useCfgStore = create<CfgState>()(
  persist(
    (): CfgState => ({
      cfg: CONFIG_PADRAO,
      carregado: false,
      erro: false,
    }),
    { name: "finapp-cfg", partialize: semErro },
  ),
);
