import { criarStoreEspelho } from "./storeEspelho";
import type { EventoCalendario } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em storeEspelho.ts. */
export const useEventosStore = criarStoreEspelho<{
  itens: EventoCalendario[];
  carregado: boolean;
  erro: boolean;
}>("finapp-eventos", { itens: [], carregado: false, erro: false });
