import { create } from "zustand";
import type { AcaoItem } from "../components/MenuAcoesItem";

/** A ação de "adicionar" da página que está aberta, tal como o header a
 *  desenha. */
export interface AcaoHeader {
  /** Nome acessível do botão "+". Tem de dizer O QUÊ se adiciona ("Adicionar
   *  evento"), porque o ícone sozinho não diz — é a única etiqueta que um
   *  leitor de ecrã tem para trabalhar. */
  rotulo: string;
  /** Fluxo único: o "+" faz isto directamente. */
  onClick?: () => void;
  /** Vários fluxos na mesma tela: o "+" abre um menu com estas opções em vez
   *  de escolher por conta própria. Quando existe, `onClick` é ignorado. */
  acoes?: AcaoItem[];
}

interface AcaoHeaderState {
  acao: AcaoHeader | null;
  /** Quem registou a ação. Só esse mesmo dono a pode limpar — assim uma
   *  página que desmonta depois da seguinte já ter montado não apaga a ação
   *  da nova (a ordem em que o React corre limpezas e efeitos numa navegação
   *  não é a nossa para garantir). */
  dono: string | null;
  definir: (dono: string, acao: AcaoHeader) => void;
  limpar: (dono: string) => void;
}

/** Ponte da página para o header, no mesmo espírito do `mesVisivelStore`: o
 *  `Header` é renderizado uma vez no `AppShell`, fora do `<Outlet>`, e sem
 *  isto uma página não tinha como pôr lá um botão seu.
 *
 *  Não é o FAB (`layout/Fab.tsx`): aquele é global e regista transações de
 *  qualquer tela. Este "+" é da tela aberta e adiciona a coisa DELA — um
 *  evento no Calendário, um fundo no Planejamento. */
export const useAcaoHeaderStore = create<AcaoHeaderState>((set) => ({
  acao: null,
  dono: null,
  definir: (dono, acao) => set({ dono, acao }),
  limpar: (dono) => set((s) => (s.dono === dono ? { dono: null, acao: null } : s)),
}));
