import { create } from "zustand";
import type { EventoCalendario } from "../types";

interface EventosState {
  itens: EventoCalendario[];
  carregado: boolean;
}

export const useEventosStore = create<EventosState>(() => ({
  itens: [],
  carregado: false,
}));
