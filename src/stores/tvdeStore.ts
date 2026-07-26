import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DadosTvde } from "../types";
import { TVDE_VAZIO } from "../services/tvdeService";

/** Espelho do módulo TVDE — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface TvdeState {
  dados: DadosTvde;
  carregado: boolean;
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: TvdeState) => ({ dados: s.dados, carregado: s.carregado });

export const useTvdeStore = create<TvdeState>()(
  persist(
    (): TvdeState => ({
      dados: TVDE_VAZIO,
      carregado: false,
      erro: false,
    }),
    { name: "finapp-tvde", partialize: semErro },
  ),
);
