import { create } from "zustand";
import type { Fundo } from "../types";

interface FundosState {
  itens: Fundo[];
  carregado: boolean;
}

export const useFundosStore = create<FundosState>(() => ({
  itens: [],
  carregado: false,
}));
