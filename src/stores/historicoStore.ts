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

export const useHistoricoStore = create<HistoricoState>((set, get) => ({
  pilha: pilhaVazia(),
  uid: null,

  iniciar: (uid) => set({ uid, pilha: pilhaVazia() }),
  parar: () => set({ uid: null, pilha: pilhaVazia() }),

  snapshot: () => {
    if (!get().uid) return;
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
