import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventoCalendario } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface EventosState {
  itens: EventoCalendario[];
  carregado: boolean;
}

export const useEventosStore = create<EventosState>()(
  persist(
    (): EventosState => ({
      itens: [],
      carregado: false,
    }),
    { name: "finapp-eventos" },
  ),
);
