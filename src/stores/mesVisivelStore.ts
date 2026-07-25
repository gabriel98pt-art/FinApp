import { create } from "zustand";
import type { YearMonth } from "../types";
import { mesAtual } from "../utils/calculos";

interface MesVisivelState {
  mes: YearMonth;
  setMes: (m: YearMonth) => void;
}

/** Mês exibido, COMPARTILHADO entre as telas que navegam por mês (Início não
 *  entra ainda; Parcelas, TVDE e Metas têm conceitos próprios de período e
 *  ficam de fora de propósito). Trocar o mês em Cartões e abrir Veículo mostra
 *  o mesmo mês. Não é persistido: cada sessão nasce no mês real. */
export const useMesVisivelStore = create<MesVisivelState>((set) => ({
  mes: mesAtual(),
  setMes: (m) => set({ mes: m }),
}));
