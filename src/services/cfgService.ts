// Configuração da conta (antigo S.cfg) em users/{uid}/fin_v5/cfg.

import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import { snapshotHistorico } from "../stores/historicoStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { semIndefinidos } from "./lancamentosService";
import type { Cents, ConfigConta, PreferenciasCopiloto, TokenCorApp, YearMonth } from "../types";
import type { TipoCartao } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import {
  patchRenomearCartao,
  patchRenomearCategoria,
  patchRenomearFonte,
  patchRenomearLocal,
  validarNomeNovo,
  type DadosRenomear,
  type ListaCategoria,
} from "../utils/renomear";

const caminho = (uid: string, sufixo = "") => `users/${uid}/fin_v5/cfg${sufixo}`;

/** O RTDB omite objetos/arrays vazios — repõe os defaults campo a campo. */
export function normalizarConfig(bruto: Partial<ConfigConta> | null): ConfigConta {
  return { ...CONFIG_PADRAO, ...(bruto ?? {}) };
}

export function observarConfig(
  uid: string,
  cb: (cfg: ConfigConta) => void,
  aoErro: (erro: Error) => void,
): () => void {
  return onValue(
    ref(db, caminho(uid)),
    (snap) => {
      cb(normalizarConfig(snap.val()));
    },
    aoErro,
  );
}

export async function atualizarConfig(uid: string, mudancas: Partial<ConfigConta>) {
  await update(ref(db, caminho(uid)), mudancas);
}

/** Adiciona um cartão/conta com o seu tipo (crédito entra no fluxo de fatura). */
export async function adicionarCartao(
  uid: string,
  cfg: ConfigConta,
  nome: string,
  tipo: TipoCartao,
) {
  if (cfg.contasCartoes.includes(nome)) throw new Error("Já existe um cartão com esse nome.");
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    contasCartoes: [...cfg.contasCartoes, nome],
    [`tipoCartao/${nome}`]: tipo,
  });
}

/** Dia em que a fatura deste cartão vence. `null`/0 apaga o dia — nem todo o
 *  cartão precisa de ter um, e sem ele nada muda em relação a antes. */
export async function definirDiaVencimentoFatura(uid: string, cartao: string, dia: number | null) {
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    [`diaVencimentoFatura/${cartao}`]: dia && dia >= 1 && dia <= 31 ? dia : null,
  });
}

/** Dia em que a fatura deste cartão FECHA. `null`/0 apaga o dia — sem ele, o
 *  ciclo é o mês civil inteiro (comportamento de sempre). */
export async function definirDiaFechamentoFatura(uid: string, cartao: string, dia: number | null) {
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    [`diaFechamentoFatura/${cartao}`]: dia && dia >= 1 && dia <= 31 ? dia : null,
  });
}

/** Raiz da conta — a renomeação com cascata escreve cfg e lançamentos de uma
 *  vez, então o `update()` sobe um nível em relação ao `caminho()` acima. */
const raiz = (uid: string) => `users/${uid}/fin_v5`;

/** Lê das stores as coleções que a cascata precisa varrer. São as mesmas que
 *  as telas já usam (espelho do RTDB alimentado pelo syncService). */
function dadosDasStores(): DadosRenomear {
  const veiculo = useVeiculoStore.getState().dados;
  return {
    receitas: useReceitasStore.getState().itens,
    despesas: useDespesasStore.getState().itens,
    despesasFixas: useDespesasFixasStore.getState().itens,
    transferencias: useTransferenciasStore.getState().itens,
    parcelas: useParcelasStore.getState().itens,
    cargas: veiculo.cargas,
    despesasVeiculo: veiculo.despesas,
    fixasVeiculo: veiculo.despesasFixas,
  };
}

/** Renomeia a conta/cartão em tudo: lista, tipo, saldo inicial, faturas
 *  (manual e pagas) e todo lançamento que apontava pro nome antigo. */
export async function renomearCartao(uid: string, cfg: ConfigConta, de: string, para: string) {
  const nome = validarNomeNovo(cfg.contasCartoes, de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearCartao(cfg, dadosDasStores(), de, nome));
}

/** Renomeia a categoria na lista indicada, no visual (ícone/cor), no orçamento
 *  e em todo lançamento categorizado com o nome antigo. */
export async function renomearCategoria(
  uid: string,
  cfg: ConfigConta,
  lista: ListaCategoria,
  de: string,
  para: string,
) {
  const nome = validarNomeNovo(cfg[lista], de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearCategoria(cfg, dadosDasStores(), lista, de, nome));
}

/** Renomeia a fonte de receita na lista, no visual e nas receitas. */
export async function renomearFonte(uid: string, cfg: ConfigConta, de: string, para: string) {
  const nome = validarNomeNovo(cfg.fontesReceita, de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearFonte(cfg, dadosDasStores(), de, nome));
}

/** Renomeia o local de carregamento na lista e nas cargas. */
export async function renomearLocal(uid: string, cfg: ConfigConta, de: string, para: string) {
  const nome = validarNomeNovo(cfg.locaisCarregamento, de, para);
  snapshotHistorico();
  await update(ref(db, raiz(uid)), patchRenomearLocal(cfg, dadosDasStores(), de, nome));
}

/** Remove a conta/cartão da lista e as suas chaves em cfg. Lançamentos que já
 *  a usam continuam com o nome antigo — mesma regra de `removerItemLista`. */
export async function removerCartao(uid: string, cfg: ConfigConta, nome: string) {
  snapshotHistorico();
  await update(ref(db, caminho(uid)), {
    contasCartoes: cfg.contasCartoes.filter((c) => c !== nome),
    [`tipoCartao/${nome}`]: null,
    [`diaVencimentoFatura/${nome}`]: null,
    [`diaFechamentoFatura/${nome}`]: null,
  });
}

type ListaDeCategorias =
  | "categoriasDespesa"
  | "categoriasVeiculo"
  | "fontesReceita"
  | "locaisCarregamento"
  | "intermediadoresParcelamento";

/** Adiciona um item a uma das listas configuráveis (categorias de despesa,
 *  fontes de receita) — usadas no Registro Rápido, Cartões e Parcelas. */
export async function adicionarItemLista(
  uid: string,
  cfg: ConfigConta,
  lista: ListaDeCategorias,
  item: string,
) {
  const nome = item.trim();
  if (!nome) throw new Error("Nome vazio.");
  if (cfg[lista].includes(nome)) throw new Error("Já existe um item com esse nome.");
  snapshotHistorico();
  await update(ref(db, caminho(uid)), { [lista]: [...cfg[lista], nome] });
}

/** Remove um item de uma das listas configuráveis. Não apaga lançamentos
 *  que já usam essa categoria — eles continuam mostrando o nome antigo. */
export async function removerItemLista(
  uid: string,
  cfg: ConfigConta,
  lista: ListaDeCategorias,
  item: string,
) {
  snapshotHistorico();
  await update(ref(db, caminho(uid)), { [lista]: cfg[lista].filter((x) => x !== item) });
}

/** Ícone da categoria (item 19) — guarda o id do ícone do `lucide-react`
 *  (ex. "utensils"); `null` volta ao círculo sem ícone. */
export async function definirIconeCategoria(uid: string, categoria: string, icone: string | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/categoriaIcone/${categoria}`));
  if (icone === null || icone === "") await remove(r);
  else await set(r, icone);
}

/** Cor da categoria (item 19) — `null` volta à cor automática do nome. */
export async function definirCorCategoria(uid: string, categoria: string, cor: string | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/categoriaCor/${categoria}`));
  if (cor === null || cor === "") await remove(r);
  else await set(r, cor);
}

/** Cor central do app (destaque/positivo/negativo/alerta/roxo), por tema —
 *  `null` volta ao valor de `tokens.css`. Mesmo padrão de
 *  `definirCorCategoria`, mas num namespace à parte: estas cinco valem para o
 *  app inteiro, não para uma categoria. */
export async function definirCorApp(
  uid: string,
  tema: "dark" | "light",
  token: TokenCorApp,
  cor: string | null,
) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/coresApp/${tema}/${token}`));
  if (cor === null || cor === "") await remove(r);
  else await set(r, cor);
}

/** Personalização do Copiloto — `null` apaga o nó inteiro.
 *
 *  É guardada num nó só, e não campo a campo, para que "desligar a
 *  personalização" seja um `remove` e não a limpeza de vários campos soltos:
 *  o nome de alguém não pode ficar para trás porque uma das escritas falhou. */
export async function definirPreferenciasCopiloto(uid: string, prefs: PreferenciasCopiloto | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, "/copiloto"));
  if (prefs === null) await remove(r);
  else await set(r, semIndefinidos(prefs));
}

/** Teto de orçamento mensal por categoria (seção 4.8) — `null`/0 remove o teto. */
export async function definirOrcamento(uid: string, categoria: string, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/orcamentos/${categoria}`));
  if (valor === null || valor === 0) await remove(r);
  else await set(r, valor);
}

/** Total que se planeia gastar por mês, somando tudo — o guarda-chuva por
 *  cima dos tetos por categoria. `null`/0 remove, mesma regra de
 *  `definirOrcamento`: um total de 0 € seria um planeamento sempre estourado,
 *  e "não definido" é o que se quer dizer. */
export async function definirOrcamentoTotal(uid: string, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, "/orcamentoTotalMensal"));
  if (valor === null || valor === 0) await remove(r);
  else await set(r, valor);
}

/** Saldo inicial da conta/cartão de débito — a base de onde o saldo atual soma
 *  e subtrai os movimentos. 0 remove a chave: é o mesmo efeito, já é o valor
 *  assumido quando não há nada guardado. */
export async function definirSaldoInicial(uid: string, conta: string, valor: Cents) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/saldosIniciais/${conta}`));
  if (valor === 0) await remove(r);
  else await set(r, valor);
}

/** Override manual da fatura (seção 4.1) — `null` volta ao cálculo automático. */
export async function definirFaturaManual(
  uid: string,
  cartao: string,
  mes: YearMonth,
  valor: Cents | null,
) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/faturaManual/${cartao}/${mes}`));
  if (valor === null) await remove(r);
  else await set(r, valor);
}
