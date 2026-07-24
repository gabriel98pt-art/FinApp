// Configuração da conta (antigo S.cfg) em users/{uid}/fin_v5/cfg.

import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "./firebase";
import { snapshotHistorico } from "../stores/historicoStore";
import type { Cents, ConfigConta, YearMonth } from "../types";
import type { TipoCartao } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

const caminho = (uid: string, sufixo = "") => `users/${uid}/fin_v5/cfg${sufixo}`;

/** O RTDB omite objetos/arrays vazios — repõe os defaults campo a campo. */
export function normalizarConfig(bruto: Partial<ConfigConta> | null): ConfigConta {
  return { ...CONFIG_PADRAO, ...(bruto ?? {}) };
}

export function observarConfig(uid: string, cb: (cfg: ConfigConta) => void): () => void {
  return onValue(ref(db, caminho(uid)), (snap) => {
    cb(normalizarConfig(snap.val()));
  });
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

type ListaDeCategorias =
  "categoriasFixas" | "categoriasCorrentes" | "fontesReceita" | "locaisCarregamento";

/** Adiciona um item a uma das 3 listas configuráveis (categorias de despesa
 *  fixa/corrente, fontes de receita) — usadas no Registro Rápido, Cartões e
 *  Parcelas. */
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

/** Remove um item de uma das 3 listas configuráveis. Não apaga lançamentos
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

/** Teto de orçamento mensal por categoria (seção 4.8) — `null`/0 remove o teto. */
export async function definirOrcamento(uid: string, categoria: string, valor: Cents | null) {
  snapshotHistorico();
  const r = ref(db, caminho(uid, `/orcamentos/${categoria}`));
  if (valor === null || valor === 0) await remove(r);
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
