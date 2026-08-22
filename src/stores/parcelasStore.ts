import { criarStoreEspelho } from "./storeEspelho";
import type { Parcela } from "../types";

/** Espelho do RTDB — alimentado só pelo syncService. Persistido localmente
 *  (seção 6.1) — ver nota em storeEspelho.ts. */
export const useParcelasStore = criarStoreEspelho<{
  itens: Parcela[];
  carregado: boolean;
  erro: boolean;
}>("finapp-parcelas", { itens: [], carregado: false, erro: false });
