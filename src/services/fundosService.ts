// Persistência de fundos/sub-metas em users/{uid}/fin_v5/fundos.

import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import type { Cents, Fundo, Id } from "../types";

const caminho = (uid: string, id?: Id) => `users/${uid}/fin_v5/fundos${id ? `/${id}` : ""}`;

function paraLista(val: Record<string, Omit<Fundo, "id">> | null): Fundo[] {
  if (!val) return [];
  return Object.entries(val).map(([id, dados]) => ({ ...dados, id }));
}

export function observarFundos(uid: string, cb: (itens: Fundo[]) => void): () => void {
  return onValue(ref(db, caminho(uid)), (snap) => cb(paraLista(snap.val())));
}

export async function criarFundo(uid: string, dados: Omit<Fundo, "id">) {
  const novo = push(ref(db, caminho(uid)));
  await set(novo, semIndefinidos(dados));
  return novo.key!;
}

export async function removerFundo(uid: string, id: Id) {
  await remove(ref(db, caminho(uid, id)));
}

/** Contribuir com um fundo — soma ao valor atual guardado. */
export async function contribuirFundo(uid: string, fundo: Fundo, valor: Cents) {
  await set(ref(db, `${caminho(uid, fundo.id)}/atual`), fundo.atual + valor);
}
