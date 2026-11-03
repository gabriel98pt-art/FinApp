import { create } from "zustand";

/** O botão que aceita: o verbo da ação («Apagar», «Pagar», «Mover») e se é
 *  vermelho. Vermelho só para o que apaga dados. */
export interface AcaoConfirmar {
  verbo: string;
  perigo?: boolean;
}

const APAGAR: AcaoConfirmar = { verbo: "Apagar", perigo: true };

interface ConfirmarState {
  mensagem: string;
  acao: AcaoConfirmar;
  aberto: boolean;
  /** Resolve a Promise de quem pediu a confirmação. */
  resolver: ((ok: boolean) => void) | null;
}

/** Diálogo de confirmação do app, no lugar do `window.confirm` do sistema —
 *  que não tem animação nenhuma e quebra a identidade visual bem no momento
 *  de uma ação destrutiva. Mesmo desenho do toast: um estado global e um só
 *  componente montado no AppShell, em vez de cada tela montar o seu. */
export const useConfirmarStore = create<ConfirmarState>(() => ({
  mensagem: "",
  acao: APAGAR,
  aberto: false,
  resolver: null,
}));

/** Abre o diálogo e resolve quando o usuário escolhe. Fechar (véu, Esc ou
 *  Cancelar) resolve `false`, igual ao `window.confirm`. Sem `acao`, o botão
 *  é o «Apagar» vermelho; o resto passa o seu verbo (`{ verbo: "Pagar" }`). */
export function confirmarAcao(mensagem: string, acao: AcaoConfirmar = APAGAR): Promise<boolean> {
  // Um pedido novo com outro já aberto cancela o anterior: quem esperava não
  // pode ficar pendurado para sempre.
  useConfirmarStore.getState().resolver?.(false);
  return new Promise<boolean>((resolve) => {
    useConfirmarStore.setState({ mensagem, acao, aberto: true, resolver: resolve });
  });
}

/** Responde ao pedido em aberto e fecha. */
export function responderConfirmacao(ok: boolean) {
  const { resolver } = useConfirmarStore.getState();
  // A mensagem e o botão ficam: o texto some da tela antes da animação de saída acabar
  // se for limpo aqui.
  useConfirmarStore.setState({ aberto: false, resolver: null });
  resolver?.(ok);
}
