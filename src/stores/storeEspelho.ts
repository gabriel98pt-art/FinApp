import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";

/** Forma comum aos stores-espelho do RTDB (seção 6.1): um campo de dados
 *  (itens/cfg/dados) + carregado + erro, alimentados só pelo syncService.
 *  `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
export function criarStoreEspelho<S extends { carregado: boolean; erro: boolean }>(
  nome: string,
  estadoInicial: S,
) {
  const semErro = (s: S): Omit<S, "erro"> => {
    const resto: Partial<S> = { ...s };
    delete resto.erro;
    return resto as Omit<S, "erro">;
  };

  return create<S>()(
    persist(() => estadoInicial, {
      name: nome,
      partialize: semErro,
      storage: persistenciaAdiada,
    }),
  );
}
