// Persistência de eventos do calendário em users/{uid}/fin_v5/eventos.

import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type { EventoCalendario, Id } from "../types";

const caminho = (uid: string, id?: Id) => `users/${uid}/fin_v5/eventos${id ? `/${id}` : ""}`;

function paraLista(val: Record<string, Omit<EventoCalendario, "id">> | null): EventoCalendario[] {
  if (!val) return [];
  return Object.entries(val).map(([id, dados]) => ({ ...dados, id }));
}

export function observarEventos(uid: string, cb: (itens: EventoCalendario[]) => void): () => void {
  return onValue(ref(db, caminho(uid)), (snap) => cb(paraLista(snap.val())));
}

export async function criarEvento(uid: string, dados: Omit<EventoCalendario, "id">) {
  snapshotHistorico();
  const novo = push(ref(db, caminho(uid)));
  await set(novo, semIndefinidos(dados));
  return novo.key!;
}

export async function removerEvento(uid: string, id: Id) {
  snapshotHistorico();
  await remove(ref(db, caminho(uid, id)));
}
