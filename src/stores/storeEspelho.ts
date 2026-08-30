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

/** Mescla o que veio do `localStorage` por cima do estado inicial —
 *  recursivo, e validando o TIPO de cada campo contra o default, não só a
 *  presença. Três voltas do mesmo P0 de 26/08, achadas em sequência sem
 *  acesso aos dados reais nem ao dispositivo, só pelo texto do erro:
 *
 *  1ª volta: o `merge` por omissão do zustand/persist é `{ ...atual,
 *  ...persistido }` — raso, um nível só. `dados`/`cfg` são objetos
 *  aninhados, e um campo (`instituicoes`, a Fase C1 de hoje) pode ter sido
 *  adicionado ao tipo DEPOIS da última vez que esta conta gravou o espelho —
 *  o merge raso trocava o objeto inteiro pelo persistido e o campo novo
 *  ficava `undefined` até o Firebase responder. Corrigido mesclando um
 *  nível a mais — mas só verificava AUSÊNCIA, não também o formato.
 *
 *  2ª volta (o Gabriel leu "`{}` is not iterable" no Inspetor Web): um
 *  campo que devia ser ARRAY (`cfg.instituicoes`) apareceu como objeto
 *  vazio `{}` num espelho antigo — nem ausente (cairia no default pela
 *  correção anterior) nem array (o resto do código sempre assumiu um). A
 *  correção anterior aceitava QUALQUER valor presente, sem checar se batia
 *  com o formato esperado. Corrigido validando o tipo recursivamente contra
 *  `estadoInicial` — mas iterando só `Object.keys(atual)`.
 *
 *  3ª volta (mesmo dia: "a fatura do cartão voltou a não paga, tive que
 *  refazer os pagamentos parciais"): iterar só `Object.keys(atual)` apaga
 *  todo o conteúdo de qualquer objeto que serve de MAPA por chave dinâmica —
 *  `cfg.faturasPagas`, `categoriaCor`, `saldosIniciais`, `orcamentos`, etc.
 *  têm default `{}` (não têm como ter chaves fixas: a chave é o id do cartão,
 *  o nome da categoria...). Com o default vazio, `Object.keys(atual)` também
 *  vinha vazio, e a rehidratação trocava o mapa inteiro por `{}` — apagando
 *  faturas pagas, cores/ícones escolhidos, saldos, tudo. Agora percorre a
 *  UNIÃO das chaves de `atual` e `persistido`: chave conhecida no default
 *  continua validada recursivamente (mantém a correção da 2ª volta); chave
 *  que só existe no persistido (entrada dinâmica de um mapa) é aceita como
 *  está — não há default contra o que validar o formato dela. */
function mesclarComDefaults(persistido: unknown, atual: unknown): unknown {
  if (Array.isArray(atual)) {
    return Array.isArray(persistido) ? persistido : atual;
  }
  if (!ehObjetoSimples(atual)) {
    return persistido !== undefined ? persistido : atual;
  }
  if (!ehObjetoSimples(persistido)) return atual;
  const combinado: Record<string, unknown> = { ...atual };
  const chaves = new Set([...Object.keys(atual), ...Object.keys(persistido)]);
  for (const chave of chaves) {
    combinado[chave] =
      chave in atual ? mesclarComDefaults(persistido[chave], atual[chave]) : persistido[chave];
  }
  return combinado;
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
      merge: (persistido, atual) => mesclarComDefaults(persistido, atual) as S,
    }),
  );
}
