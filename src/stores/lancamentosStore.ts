import { create } from "zustand";
import type { DespesaCorrente, Receita } from "../types";

/** Estado espelho do RTDB — alimentado só pelo syncService, nunca por
 *  componentes. `carregado` distingue "sem dados" de "ainda carregando". */
interface ListaState<T> {
  itens: T[];
  carregado: boolean;
}

export const useReceitasStore = create<ListaState<Receita>>(() => ({
  itens: [],
  carregado: false,
}));

export const useDespesasStore = create<ListaState<DespesaCorrente>>(() => ({
  itens: [],
  carregado: false,
}));
