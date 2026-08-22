import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";
import type { DespesaCorrente, DespesaFixa, Receita, Transferencia } from "../types";

/** Estado espelho do RTDB — alimentado só pelo syncService, nunca por
 *  componentes. `carregado` distingue "sem dados" de "ainda carregando".
 *  Persistido localmente (seção 6.1) — ver nota em cfgStore.ts. */
interface ListaState<T> {
  itens: T[];
  carregado: boolean;
  /** Subscrição caiu (rede/regra). Os `itens` já carregados continuam
   *  válidos — só deixaram de ser atualizados. */
  erro: boolean;
}

/** `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
const semErro = <T>(s: ListaState<T>) => ({ itens: s.itens, carregado: s.carregado });

export const useReceitasStore = create<ListaState<Receita>>()(
  persist(
    (): ListaState<Receita> => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-receitas", partialize: semErro, storage: persistenciaAdiada },
  ),
);

export const useDespesasStore = create<ListaState<DespesaCorrente>>()(
  persist(
    (): ListaState<DespesaCorrente> => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-despesas", partialize: semErro, storage: persistenciaAdiada },
  ),
);

export const useDespesasFixasStore = create<ListaState<DespesaFixa>>()(
  persist(
    (): ListaState<DespesaFixa> => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-despesasFixas", partialize: semErro, storage: persistenciaAdiada },
  ),
);

export const useTransferenciasStore = create<ListaState<Transferencia>>()(
  persist(
    (): ListaState<Transferencia> => ({
      itens: [],
      carregado: false,
      erro: false,
    }),
    { name: "finapp-transferencias", partialize: semErro, storage: persistenciaAdiada },
  ),
);
