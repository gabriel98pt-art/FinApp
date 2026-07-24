import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DadosTvde } from "../types";
import { TVDE_VAZIO } from "../services/tvdeService";

/** Espelho do módulo TVDE — alimentado só pelo syncService. Persistido
 *  localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface TvdeState {
  dados: DadosTvde;
  carregado: boolean;
}

export const useTvdeStore = create<TvdeState>()(
  persist(
    (): TvdeState => ({
      dados: TVDE_VAZIO,
      carregado: false,
    }),
    { name: "finapp-tvde" },
  ),
);
