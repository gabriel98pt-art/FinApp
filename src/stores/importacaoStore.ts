import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LinhaAnalisada } from "../types";

type AtualizadorLinhas =
  | LinhaAnalisada[]
  | null
  | ((atual: LinhaAnalisada[] | null) => LinhaAnalisada[] | null);

interface ImportacaoState {
  /** Extrato colado/carregado, ainda por analisar — sobrevive à troca de aba
   *  como o resto deste rascunho. */
  texto: string;
  /** Linhas já analisadas, ainda por confirmar. `null` = nenhum extrato em
   *  andamento. */
  linhas: LinhaAnalisada[] | null;
  setTexto: (texto: string) => void;
  setLinhas: (valor: AtualizadorLinhas) => void;
  /** Escape hatch: limpa o rascunho inteiro, mesmo que algo tenha ficado num
   *  estado estranho. Sem isto, um extrato mal analisado ficava preso na tela
   *  para sempre — persistido, sobrevivia até a um refresh da página. */
  resetar: () => void;
}

/** Rascunho da importação de extrato (seção "Importar"), persistido no
 *  aparelho — nada aqui é dado gravado, é só o que o usuário ainda não
 *  confirmou. Antes vivia em `useState` dentro da página e desaparecia ao
 *  trocar de aba (o componente desmonta); agora atravessa a navegação e até
 *  um refresh, exatamente como o extrato ficou na tela antes de sair. */
export const useImportacaoStore = create<ImportacaoState>()(
  persist(
    (set) => ({
      texto: "",
      linhas: null,
      setTexto: (texto) => set({ texto }),
      setLinhas: (valor) =>
        set((s) => ({
          linhas: typeof valor === "function" ? valor(s.linhas) : valor,
        })),
      resetar: () => set({ texto: "", linhas: null }),
    }),
    { name: "finapp-importacao-rascunho", version: 1 },
  ),
);
