import { criarStoreEspelho } from "./storeEspelho";
import type { Fundo } from "../types";

/** Persistido localmente (seção 6.1) — ver nota em storeEspelho.ts. */
export const useFundosStore = criarStoreEspelho<{
  itens: Fundo[];
  carregado: boolean;
  erro: boolean;
}>("finapp-fundos", { itens: [], carregado: false, erro: false });
