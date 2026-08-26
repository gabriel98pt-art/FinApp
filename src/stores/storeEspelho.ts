import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";

/** Forma comum aos stores-espelho do RTDB (seção 6.1): um campo de dados
 *  (itens/cfg/dados) + carregado + erro, alimentados só pelo syncService.
 *  `erro` NÃO é persistido (partialize): ele descreve a subscrição desta
 *  sessão, não os dados. Como "Tentar novamente" recarrega a página, um
 *  `erro: true` gravado faria o aviso reaparecer no arranque seguinte, antes
 *  de a nova subscrição ter tido hipótese de responder. */
/** Objeto simples (não array, não `null`) — é só nestes que faz sentido
 *  mesclar campo a campo em vez de substituir por inteiro. */
function ehObjetoSimples(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Mescla o que veio do `localStorage` por cima do estado inicial, um nível
 *  a mais do que o `merge` por omissão do zustand/persist.
 *
 *  O `merge` por omissão é `{ ...atual, ...persistido }` — raso. Isso é
 *  seguro para os campos de array (`itens`) porque "ausente" e "vazio" são a
 *  mesma coisa em `persisted.itens ?? undefined`. Mas `dados`/`cfg` são
 *  OBJETOS aninhados com vários campos lá dentro, e um deles pode ter sido
 *  adicionado ao tipo DEPOIS da última vez que esta conta gravou o espelho —
 *  o merge raso troca o objeto inteiro pelo persistido e o campo novo fica
 *  `undefined` até o Firebase responder pela primeira vez, em vez de cair no
 *  default do `estadoInicial` como devia. Foi exatamente isto que derrubou o
 *  app inteiro no P0 de 26/08 (achado tarde, sem acesso aos dados reais):
 *  `cfg`/`dados` persistidos de antes de um campo existir, undefined onde o
 *  resto do código sempre assumiu um array. */
function mesclarComDefaults<S extends Record<string, unknown>>(persistido: unknown, atual: S): S {
  if (!ehObjetoSimples(persistido)) return atual;
  const combinado: Record<string, unknown> = { ...atual, ...persistido };
  for (const chave of Object.keys(atual)) {
    const valorAtual = atual[chave];
    const valorPersistido = persistido[chave];
    if (ehObjetoSimples(valorAtual) && ehObjetoSimples(valorPersistido)) {
      combinado[chave] = { ...valorAtual, ...valorPersistido };
    }
  }
  return combinado as S;
}

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
      merge: (persistido, atual) => mesclarComDefaults(persistido, atual),
    }),
  );
}
