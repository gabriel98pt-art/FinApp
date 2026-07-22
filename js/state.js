// Estado central simples (pub/sub) — sem framework, só o suficiente pra UI
// reagir a mudanças de lançamentos/usuário sem passar callbacks manualmente
// por toda parte.
const state = {
  user: null,
  lancamentos: [],
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, partial);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
