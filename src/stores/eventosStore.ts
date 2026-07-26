import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventoCalendario } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface EventosState {
  itens: EventoCalendario[];
  carregado: boolean;
  /** Subscrição caiu (rede/regra) — ver nota abaixo. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = (s: EventosState) => ({ itens: s.itens, carregado: s.carregado });

export const useEventosStore = create<EventosState>()(
  persist(
    (): EventosState => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-eventos", partialize: semErro },
  ),
);
