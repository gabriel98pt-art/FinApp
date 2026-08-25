import { create } from "zustand";
import { capturarEstadoAtual, restaurarEstado } from "../services/historicoService";
import { desfazer, empilhar, pilhaVazia, refazer, type HistoricoStack } from "../utils/historico";
import { mostrarToast } from "./toastStore";

interface HistoricoState {
  pilha: HistoricoStack;
  uid: string | null;
  /** Liga o histórico a uma conta — chamado no login (seção 4.9: nunca
   *  vazar undo/redo de uma conta pra outra). */
  iniciar: (uid: string) => void;
  parar: () => void;
  /** snapshot(): chame ANTES de qualquer mutação que deva ser desfazível. */
  snapshot: () => void;
  desfazer: () => Promise<void>;
  refazer: () => Promise<void>;
}

/** Achado ao investigar um "Desfazer" que só revertia parte de uma
 *  importação: cada `criar/atualizar/remover` chama `snapshotHistorico()` a
 *  título individual — certo quando é a única escrita da ação do usuário,
 *  errado quando várias dessas funções são chamadas em sequência por UMA
 *  ação só (importar um extrato inteiro: dezenas de lançamentos + cargas +
 *  transferências + pagamentos de fatura + apagar duplicatas). Sem isto,
 *  cada uma empilhava o SEU PRÓPRIO ponto de desfazer, e um clique em
 *  "Desfazer" só voltava a última chamada — o resto da importação ficava
 *  para trás, exigindo dezenas de cliques pra reverter tudo. */
let suprimirSnapshots = false;

/** Envolve uma sequência de escritas que devem contar como UM só passo de
 *  desfazer: o chamador tira o snapshot manualmente ANTES (via
 *  `snapshotHistorico()`), e tudo o que rodar dentro de `fn` tem os seus
 *  próprios `snapshotHistorico()` internos silenciados. */
export async function comHistoricoSuprimido<T>(fn: () => Promise<T>): Promise<T> {
  const jaSuprimido = suprimirSnapshots;
  suprimirSnapshots = true;
  try {
    return await fn();
  } finally {
    suprimirSnapshots = jaSuprimido;
  }
}

export const useHistoricoStore = create<HistoricoState>((set, get) => ({
  pilha: pilhaVazia(),
  uid: null,

  iniciar: (uid) => set({ uid, pilha: pilhaVazia() }),
  parar: () => set({ uid: null, pilha: pilhaVazia() }),

  snapshot: () => {
    if (!get().uid || suprimirSnapshots) return;
    set((s) => ({ pilha: empilhar(s.pilha, capturarEstadoAtual()) }));
  },

  desfazer: async () => {
    const { pilha, uid } = get();
    if (!uid) return;
    const r = desfazer(pilha, capturarEstadoAtual());
    if (r.estado === null) return;
    set({ pilha: r.h });
    try {
      await restaurarEstado(uid, r.estado);
      mostrarToast("↩ Desfeito");
    } catch {
      mostrarToast("Não foi possível desfazer.");
    }
  },

  refazer: async () => {
    const { pilha, uid } = get();
    if (!uid) return;
    const r = refazer(pilha);
    if (r.estado === null) return;
    set({ pilha: r.h });
    try {
      await restaurarEstado(uid, r.estado);
      mostrarToast("↪ Refeito");
    } catch {
      mostrarToast("Não foi possível refazer.");
    }
  },
}));

/** snapshot() chamável de qualquer service, sem precisar do hook do React —
 *  igual à função global snapshot() da origem. */
export function snapshotHistorico() {
  useHistoricoStore.getState().snapshot();
}
