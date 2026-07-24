import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Parcela } from "../types";

/** Espelho do RTDB — alimentado só pelo syncService. Persistido localmente
 *  (seção 6.1) — ver nota em cfgStore.ts. */
interface ParcelasState {
  itens: Parcela[];
  carregado: boolean;
}

export const useParcelasStore = create<ParcelasState>()(
  persist(
    (): ParcelasState => ({
      itens: [],
      carregado: false,
    }),
    { name: "finapp-parcelas" },
  ),
);
