// Renomear com cascata (categoria, fonte de receita, local de carregamento).
// Renomear só na lista de `cfg` deixaria todo lançamento antigo
// apontando pro nome que sumiu — a categoria vira "órfã" e o gasto some do
// orçamento. Por isso cada renomeação monta UM mapa de caminhos (relativo a
// users/{uid}/fin_v5) com a lista, as chaves de cfg indexadas pelo nome e cada
// lançamento afetado, pra ir num `update()` só.
//
// Conta/cartão NÃO está aqui, e é de propósito: desde a Fase C o que o
// lançamento guarda é o id do método de pagamento, que não muda nunca.
// Renomear passou a ser uma escrita só, no nome da instituição
// (`cfgService.renomearCartao`), e quem mostra o nome resolve-o na hora
// (`utils/instituicoes.ts`).
//
// Funções puras: quem grava é o cfgService.

import type {
  Abastecimento,
  ConfigConta,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  Id,
  Parcela,
  Receita,
  Transferencia,
} from "../types";

/** Caminho → valor novo, relativo a `users/{uid}/fin_v5`. */
export type PatchRenomear = Record<string, unknown>;

/** Coleções varridas pela cascata — as mesmas que as stores mantêm. */
export interface DadosRenomear {
  receitas: Receita[];
  despesas: DespesaCorrente[];
  despesasFixas: DespesaFixa[];
  transferencias: Transferencia[];
  parcelas: Parcela[];
  cargas: Abastecimento[];
  despesasVeiculo: DespesaVeiculo[];
  /** Fixas do veículo — coleção separada, mas o mesmo tipo DespesaFixa. */
  fixasVeiculo: DespesaFixa[];
}

export const DADOS_RENOMEAR_VAZIOS: DadosRenomear = {
  receitas: [],
  despesas: [],
  despesasFixas: [],
  transferencias: [],
  parcelas: [],
  cargas: [],
  despesasVeiculo: [],
  fixasVeiculo: [],
};

/** Troca um item da lista mantendo a posição. */
function listaRenomeada(lista: string[], de: string, para: string): string[] {
  return lista.map((x) => (x === de ? para : x));
}

/** Move a entrada `de` → `para` num mapa indexado por nome, escrevendo os dois
 *  caminhos (o novo com o valor, o antigo com `null` = apagar). Nada acontece
 *  se não houver entrada pro nome antigo. */
function moverChave(
  patch: PatchRenomear,
  prefixo: string,
  mapa: Record<string, unknown> | undefined,
  de: string,
  para: string,
) {
  const valor = mapa?.[de];
  if (valor === undefined) return;
  patch[`${prefixo}/${para}`] = valor;
  patch[`${prefixo}/${de}`] = null;
}

/** Grava `campo` do item quando ele aponta pro nome antigo. */
function trocarCampo<T extends { id: Id }>(
  patch: PatchRenomear,
  colecao: string,
  itens: T[],
  campo: keyof T & string,
  de: string,
  para: string,
) {
  for (const item of itens) {
    if (item[campo] === de) patch[`${colecao}/${item.id}/${campo}`] = para;
  }
}

/** Caracteres que o Realtime Database não aceita numa chave — e o nome vira
 *  chave em cfg (tipoCartao, orçamento, ícone…). Sem esta checagem, a gravação
 *  falharia com um erro do Firebase que não diz nada ao usuário. */
const PROIBIDOS = /[.#$[\]/]/;

/** Nome novo válido? (não vazio, sem caractere proibido e ainda não usado na
 *  mesma lista) — devolve o nome já sem espaços nas pontas. */
export function validarNomeNovo(lista: string[], de: string, para: string): string {
  const nome = para.trim();
  if (!nome) throw new Error("Nome vazio.");
  if (PROIBIDOS.test(nome)) throw new Error("O nome não pode ter . # $ [ ] nem barra.");
  if (nome === de) throw new Error("O nome é o mesmo.");
  if (lista.includes(nome)) throw new Error("Já existe um item com esse nome.");
  return nome;
}

/** Categorias de despesa é a única lista renomeável deste tipo — fontes de
 *  receita e locais de carregamento têm as próprias funções de patch abaixo.
 *  "categoriasVeiculo" existiu aqui até o ajuste F do lote de 30/08: despesa
 *  do veículo deixou de ter categoria (nome livre + ícone/cor únicos, em
 *  Definições › Veículo). */
export type ListaCategoria = "categoriasDespesa";

/** Categoria: a lista escolhida, o visual (ícone/cor — namespace compartilhado
 *  entre as 2 listas e as fontes, ver types/config.ts), o teto de orçamento, e
 *  a categoria de cada lançamento. */
export function patchRenomearCategoria(
  cfg: ConfigConta,
  dados: DadosRenomear,
  lista: ListaCategoria,
  de: string,
  para: string,
): PatchRenomear {
  const patch: PatchRenomear = {
    [`cfg/${lista}`]: listaRenomeada(cfg[lista], de, para),
  };
  moverChave(patch, "cfg/categoriaIcone", cfg.categoriaIcone, de, para);
  moverChave(patch, "cfg/categoriaCor", cfg.categoriaCor, de, para);
  moverChave(patch, "cfg/orcamentos", cfg.orcamentos, de, para);

  trocarCampo(patch, "despesasCorrentes", dados.despesas, "categoria", de, para);
  trocarCampo(patch, "despesasFixas", dados.despesasFixas, "categoria", de, para);
  trocarCampo(patch, "veiculo/despesasFixas", dados.fixasVeiculo, "categoria", de, para);
  trocarCampo(patch, "veiculo/despesas", dados.despesasVeiculo, "categoria", de, para);
  trocarCampo(patch, "parcelas", dados.parcelas, "categoria", de, para);
  return patch;
}

/** Fonte de receita: a lista, o visual (mesmo namespace da categoria) e a
 *  fonte de cada receita. */
export function patchRenomearFonte(
  cfg: ConfigConta,
  dados: DadosRenomear,
  de: string,
  para: string,
): PatchRenomear {
  const patch: PatchRenomear = {
    "cfg/fontesReceita": listaRenomeada(cfg.fontesReceita, de, para),
  };
  moverChave(patch, "cfg/categoriaIcone", cfg.categoriaIcone, de, para);
  moverChave(patch, "cfg/categoriaCor", cfg.categoriaCor, de, para);
  trocarCampo(patch, "receitas", dados.receitas, "fonte", de, para);
  return patch;
}

/** Local de carregamento: a lista e o local de cada carga. */
export function patchRenomearLocal(
  cfg: ConfigConta,
  dados: DadosRenomear,
  de: string,
  para: string,
): PatchRenomear {
  const patch: PatchRenomear = {
    "cfg/locaisCarregamento": listaRenomeada(cfg.locaisCarregamento, de, para),
  };
  trocarCampo(patch, "veiculo/cargas", dados.cargas, "local", de, para);
  return patch;
}
