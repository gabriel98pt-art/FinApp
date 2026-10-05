// Persistência de fundos/sub-metas em users/{uid}/fin_v5/fundos.

import { onValue, push, ref, remove, runTransaction, set } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type { Cents, Fundo, Id } from "../types";

const caminho = (uid: string, id?: Id) => `users/${uid}/fin_v5/fundos${id ? `/${id}` : ""}`;

function paraLista(val: Record<string, Omit<Fundo, "id">> | null): Fundo[] {
  if (!val) return [];
  return Object.entries(val).map(([id, dados]) => ({ ...dados, id }));
}

export function observarFundos(
  uid: string,
  cb: (itens: Fundo[]) => void,
  aoErro: (erro: Error) => void,
): () => void {
  return onValue(ref(db, caminho(uid)), (snap) => cb(paraLista(snap.val())), aoErro);
}

export async function criarFundo(uid: string, dados: Omit<Fundo, "id">) {
  snapshotHistorico();
  const novo = push(ref(db, caminho(uid)));
  await set(novo, semIndefinidos(dados));
  return novo.key!;
}

export async function removerFundo(uid: string, id: Id) {
  snapshotHistorico();
  await remove(ref(db, caminho(uid, id)));
}

/**
 * Contribuir com um fundo — soma ao valor atual guardado.
 *
 * Usa `runTransaction` (não `set`) porque `fundo.atual` vem de um snapshot já
 * carregado no cliente: duas contribuições próximas no tempo (duplo toque,
 * duas abas, Planejamento e o Copiloto em paralelo) partiriam do mesmo valor
 * antigo e a segunda escrita apagaria a primeira contribuição sem erro nem
 * aviso. A transação lê e incrementa o valor atomicamente no servidor,
 * eliminando essa corrida independentemente de quem chama.
 */
export async function contribuirFundo(uid: string, fundo: Fundo, valor: Cents) {
  snapshotHistorico();
  await runTransaction(
    ref(db, `${caminho(uid, fundo.id)}/atual`),
    (atual: number | null) => (atual ?? 0) + valor,
  );
}
