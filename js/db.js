import {
  ref,
  push,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { rtdb } from "./firebase-init.js";

// Todo o dado do usuário fica isolado em users/<uid>/... — regra já vem
// assim desde o database.rules.json, sem precisar de migração depois
// (diferente do AppFinanceiro, que só isolou por uid meses depois de lançar).
function lancamentosPath(uid) {
  return `users/${uid}/lancamentos`;
}

export function watchLancamentos(uid, callback) {
  const r = ref(rtdb, lancamentosPath(uid));
  return onValue(r, (snap) => {
    const val = snap.val() || {};
    const lista = Object.entries(val).map(([id, l]) => ({ id, ...l }));
    callback(lista);
  });
}

export function addLancamento(uid, lancamento) {
  const r = ref(rtdb, lancamentosPath(uid));
  return push(r, lancamento);
}

export function updateLancamento(uid, id, changes) {
  const r = ref(rtdb, `${lancamentosPath(uid)}/${id}`);
  return update(r, changes);
}

export function removeLancamento(uid, id) {
  const r = ref(rtdb, `${lancamentosPath(uid)}/${id}`);
  return remove(r);
}
