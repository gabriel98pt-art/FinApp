import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DespesaCorrente, Receita } from "../types";

/** Estado espelho do RTDB — alimentado só pelo syncService, nunca por
 *  componentes. `carregado` distingue "sem dados" de "ainda carregando".
 *  Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface ListaState<T> {
  itens: T[];
  carregado: boolean;
}

export const useReceitasStore = create<ListaState<Receita>>()(
  persist(
    (): ListaState<Receita> => ({
      itens: [],
      carregado: false,
    }),
    { name: "finapp-receitas" },
  ),
);

export const useDespesasStore = create<ListaState<DespesaCorrente>>()(
  persist(
    (): ListaState<DespesaCorrente> => ({
      itens: [],
      carregado: false,
    }),
    { name: "finapp-despesas" },
  ),
);
