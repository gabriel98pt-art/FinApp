import { create } from "zustand";
import type { Id } from "../types";

/** Tipos que o registro rápido (FAB) sabe lançar. Os dois do veículo são só
 *  de criação — a edição deles continua na tela Veículo (item 3/6). */
export type TipoRegistro = "receita" | "despesa" | "carga" | "despesaVeiculo";

interface UiState {
  /** Bottom sheet de registro rápido. `editandoId` presente = modo edição. */
  registroAberto: boolean;
  registroTipo: TipoRegistro;
  editandoId: Id | null;
  abrirRegistro: (tipo?: TipoRegistro, editandoId?: Id) => void;
  fecharRegistro: () => void;
  /** Menu do "+" (item 1 do lote de UX/nav): a primeira escolha — Nova
   *  despesa / Nova receita / Veículo — antes de entrar no formulário. Só
   *  serve para CRIAR: a edição abre `registroAberto` direto, sem passar por
   *  aqui (ver `abrirRegistro` nas listas, que já leva o `editandoId`). */
  menuRegistroAberto: boolean;
  abrirMenuRegistro: () => void;
  fecharMenuRegistro: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  registroAberto: false,
  registroTipo: "despesa",
  editandoId: null,
  abrirRegistro: (tipo = "despesa", editandoId) =>
    set({ registroAberto: true, registroTipo: tipo, editandoId: editandoId ?? null }),
  fecharRegistro: () => set({ registroAberto: false, editandoId: null }),
  menuRegistroAberto: false,
  abrirMenuRegistro: () => set({ menuRegistroAberto: true }),
  fecharMenuRegistro: () => set({ menuRegistroAberto: false }),
}));
