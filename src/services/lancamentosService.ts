// Persistência de lançamentos no Realtime Database (seção 8): componentes de
// UI nunca importam firebase/* — só este serviço. Cada conta é isolada em
// users/{uid} (Security Rules); `fin_v5` marca o schema da reescrita
// (o app legado usava fin_v4).

import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
import type { DespesaCorrente, Id, Parcela, Receita } from "../types";

type Dominio = "receitas" | "despesasCorrentes" | "parcelas";

export function caminhoDominio(uid: string, dominio: Dominio, id?: Id): string {
  return `users/${uid}/fin_v5/${dominio}${id ? `/${id}` : ""}`;
}
const caminho = caminhoDominio;

/** RTDB rejeita `undefined` — remove chaves opcionais vazias antes de gravar. */
export function semIndefinidos<T extends object>(dados: T): T {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as T;
}

/** RTDB devolve um objeto {pushId: dados}; convertemos para lista com id. */
function paraLista<T extends { id: Id }>(val: Record<string, Omit<T, "id">> | null): T[] {
  if (!val) return [];
  return Object.entries(val).map(([id, dados]) => ({ ...dados, id }) as T);
}

function observar<T extends { id: Id }>(
  uid: string,
  dominio: Dominio,
  cb: (itens: T[]) => void,
): () => void {
  return onValue(ref(db, caminho(uid, dominio)), (snap) => {
    cb(paraLista<T>(snap.val()));
  });
}

async function criar<T extends { id: Id }>(
  uid: string,
  dominio: Dominio,
  dados: Omit<T, "id">,
): Promise<Id> {
  const novo = push(ref(db, caminho(uid, dominio)));
  await set(novo, semIndefinidos(dados));
  return novo.key!;
}

async function atualizar<T extends { id: Id }>(uid: string, dominio: Dominio, item: T) {
  const { id, ...dados } = item;
  await set(ref(db, caminho(uid, dominio, id)), semIndefinidos(dados));
}

async function remover(uid: string, dominio: Dominio, id: Id) {
  await remove(ref(db, caminho(uid, dominio, id)));
}

// ---- Receitas ----
export const observarReceitas = (uid: string, cb: (itens: Receita[]) => void) =>
  observar<Receita>(uid, "receitas", cb);
export const criarReceita = (uid: string, dados: Omit<Receita, "id">) =>
  criar<Receita>(uid, "receitas", dados);
export const atualizarReceita = (uid: string, item: Receita) => atualizar(uid, "receitas", item);
export const removerReceita = (uid: string, id: Id) => remover(uid, "receitas", id);

// ---- Despesas correntes ----
export const observarDespesas = (uid: string, cb: (itens: DespesaCorrente[]) => void) =>
  observar<DespesaCorrente>(uid, "despesasCorrentes", cb);
export const criarDespesa = (uid: string, dados: Omit<DespesaCorrente, "id">) =>
  criar<DespesaCorrente>(uid, "despesasCorrentes", dados);
export const atualizarDespesa = (uid: string, item: DespesaCorrente) =>
  atualizar(uid, "despesasCorrentes", item);
export const removerDespesa = (uid: string, id: Id) => remover(uid, "despesasCorrentes", id);

// ---- Parcelas ----
export const observarParcelas = (uid: string, cb: (itens: Parcela[]) => void) =>
  observar<Parcela>(uid, "parcelas", cb);
export const criarParcela = (uid: string, dados: Omit<Parcela, "id">) =>
  criar<Parcela>(uid, "parcelas", dados);
export const removerParcela = (uid: string, id: Id) => remover(uid, "parcelas", id);
