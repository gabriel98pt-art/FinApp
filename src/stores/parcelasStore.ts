import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";
import type { Parcela } from "../types";

/** Espelho do RTDB — alimentado só pelo syncService. Persistido localmente
 *  (seção 6.1) — ver nota em cfgStore.ts. */
interface ParcelasState {
  itens: Parcela[];
  carregado: boolean;
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: ParcelasState) => ({ itens: s.itens, carregado: s.carregado });

export const useParcelasStore = create<ParcelasState>()(
  persist(
    (): ParcelasState => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-parcelas", partialize: semErro, storage: persistenciaAdiada },
  ),
);
