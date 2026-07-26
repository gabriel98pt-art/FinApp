import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Fundo } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface FundosState {
  itens: Fundo[];
  carregado: boolean;
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: FundosState) => ({ itens: s.itens, carregado: s.carregado });

export const useFundosStore = create<FundosState>()(
  persist(
    (): FundosState => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-fundos", partialize: semErro },
  ),
);
