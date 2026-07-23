import { create } from "zustand";
import type { DadosTvde } from "../types";
import { TVDE_VAZIO } from "../services/tvdeService";

/** Espelho do módulo TVDE — alimentado só pelo syncService. */
interface TvdeState {
  dados: DadosTvde;
  carregado: boolean;
}

export const useTvdeStore = create<TvdeState>(() => ({
  dados: TVDE_VAZIO,
  carregado: false,
}));
