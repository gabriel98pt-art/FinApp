import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";

interface CartoesVistaState {
  /** A lista de cartões e contas no topo de Cartões recolhida numa só linha. */
  contasEscondidas: boolean;
  alternarContas: () => void;
}

/** Preferência local do aparelho (persistida), como o tema. */
export const useCartoesVistaStore = create<CartoesVistaState>()(
  persist(
    (set) => ({
      contasEscondidas: false,
      alternarContas: () => set((s) => ({ contasEscondidas: !s.contasEscondidas })),
    }),
    { name: "finapp-cartoes-vista", storage: persistenciaAdiada },
  ),
);
