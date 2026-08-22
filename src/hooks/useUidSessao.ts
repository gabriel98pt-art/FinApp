import { useAuthStore } from "../stores/authStore";

/** Uid da sessão, para as páginas que só existem atrás do gate de sessão.
 *
 *  `Conteudo` (App.tsx) só monta `<Routes>` com `status === "autenticado"` —
 *  nesse estado `sessao` nunca é `null`. Antes desta função, cada página
 *  lia `sessao?.uid` e forçava com `uid!` em toda chamada de serviço: 56
 *  asserções repetindo a mesma premissa em 8 arquivos (achado da auditoria
 *  de Arquitetura & Código). A asserção fica UMA vez, aqui. */
export function useUidSessao(): string {
  return useAuthStore((s) => s.sessao!.uid);
}
