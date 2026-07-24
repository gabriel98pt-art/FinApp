import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Fundo } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface FundosState {
  itens: Fundo[];
  carregado: boolean;
}

export const useFundosStore = create<FundosState>()(
  persist(
    (): FundosState => ({
      itens: [],
      carregado: false,
    }),
    { name: "finapp-fundos" },
  ),
);
