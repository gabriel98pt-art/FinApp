import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";
import type { LinhaAnalisada } from "../types";

type AtualizadorLinhas =
  LinhaAnalisada[] | null | ((atual: LinhaAnalisada[] | null) => LinhaAnalisada[] | null);

interface ImportacaoState {
  /** Extrato colado/carregado, ainda por analisar — sobrevive à troca de aba
   *  como o resto deste rascunho. */
  texto: string;
  /** Linhas já analisadas, ainda por confirmar. `null` = nenhum extrato em
   *  andamento. */
  linhas: LinhaAnalisada[] | null;
  /** Timestamp de quando `linhas` foi confirmado com sucesso, ou `null` se
   *  ainda não foi (ou já foi limpo). Enquanto isto tem valor, a tela mostra
   *  "importado" em vez do formulário de revisão — as marcações continuam
   *  aqui, então se o usuário desfizer (↩) por engano ter confirmado, a
   *  revisão volta exatamente como estava, sem reanalisar o extrato do zero. */
  importadoEm: number | null;
  /** Quantos lançamentos a última confirmação gravou de facto — o número que
   *  a tela "importado" mostra. `linhas.length` contava também as puladas. */
  totalImportado: number | null;
  /** Posição da pilha de undo no momento da confirmação, para saber se um
   *  "Desfazer" já passou por cima dela. Fica aqui (e não num useState da
   *  página) para sobreviver a sair da aba Importar e voltar. Campo novo e
   *  opcional na persistência: um rascunho antigo sem ele cai no `null` do
   *  estado inicial, por isso não precisou de subir a `version`. */
  indiceAoImportar: number | null;
  setTexto: (texto: string) => void;
  setLinhas: (valor: AtualizadorLinhas) => void;
  setImportadoEm: (valor: number | null) => void;
  /** Marca a confirmação: quando, quantos entraram e onde estava a pilha de
   *  undo. Os três andam sempre juntos. */
  marcarImportado: (totalImportado: number, indiceAoImportar: number) => void;
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
      importadoEm: null,
      totalImportado: null,
      indiceAoImportar: null,
      setTexto: (texto) => set({ texto }),
      setLinhas: (valor) =>
        set((s) => ({
          linhas: typeof valor === "function" ? valor(s.linhas) : valor,
        })),
      setImportadoEm: (importadoEm) =>
        set(
          importadoEm === null
            ? { importadoEm, totalImportado: null, indiceAoImportar: null }
            : { importadoEm },
        ),
      marcarImportado: (totalImportado, indiceAoImportar) =>
        set({ importadoEm: Date.now(), totalImportado, indiceAoImportar }),
      resetar: () =>
        set({
          texto: "",
          linhas: null,
          importadoEm: null,
          totalImportado: null,
          indiceAoImportar: null,
        }),
    }),
    { name: "finapp-importacao-rascunho", version: 1, storage: persistenciaAdiada },
  ),
);
