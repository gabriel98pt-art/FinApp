import { criarStoreEspelho } from "./storeEspelho";
import type { DespesaCorrente, DespesaFixa, Receita, Transferencia } from "../types";

/** Estados espelho do RTDB — alimentados só pelo syncService, nunca por
 *  componentes. `carregado` distingue "sem dados" de "ainda carregando".
 *  Persistidos localmente (seção 6.1) — ver nota em cfgStore.ts. */
export const useReceitasStore = criarStoreEspelho<{
  itens: Receita[];
  carregado: boolean;
  erro: boolean;
}>("finapp-receitas", { itens: [], carregado: false, erro: false });

export const useDespesasStore = criarStoreEspelho<{
  itens: DespesaCorrente[];
  carregado: boolean;
  erro: boolean;
}>("finapp-despesas", { itens: [], carregado: false, erro: false });

export const useDespesasFixasStore = criarStoreEspelho<{
  itens: DespesaFixa[];
  carregado: boolean;
  erro: boolean;
}>("finapp-despesasFixas", { itens: [], carregado: false, erro: false });

export const useTransferenciasStore = criarStoreEspelho<{
  itens: Transferencia[];
  carregado: boolean;
  erro: boolean;
}>("finapp-transferencias", { itens: [], carregado: false, erro: false });
