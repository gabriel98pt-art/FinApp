import { create } from "zustand";
import type { Parcela } from "../types";

/** Espelho do RTDB — alimentado só pelo syncService. */
interface ParcelasState {
  itens: Parcela[];
  carregado: boolean;
}

export const useParcelasStore = create<ParcelasState>(() => ({
  itens: [],
  carregado: false,
}));
