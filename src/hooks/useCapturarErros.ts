import { useEffect } from "react";
import { registrarErro } from "../services/erroService";
import { useAuthStore } from "../stores/authStore";

/** Apanha os erros que ninguém tratou — exceções soltas (`error`) e promessas
 *  rejeitadas sem catch (`unhandledrejection`) — e grava-os na conta, para
 *  poderem ser consultados depois em Definições → Erros recentes.
 *
 *  Estes são justamente os que o ErrorBoundary NÃO vê: ele só apanha o que
 *  rebenta durante o render, não o que falha num clique ou numa gravação.
 *
 *  Fica fora do gate de sessão (como o usePwaUpdate), mas sem `uid` não há
 *  onde gravar — nesse caso o erro só vai para o console. O `uid` é lido no
 *  momento do disparo, não no registo do listener: quem entra na conta a
 *  seguir a um erro não perde os que vierem depois. */
export function useCapturarErros() {
  const uid = useAuthStore((s) => s.sessao?.uid);

  useEffect(() => {
    if (!uid) return;

    function gravar(mensagem: string, pilha?: string) {
      void registrarErro(uid!, {
        mensagem,
        pilha,
        url: window.location.href,
        timestamp: Date.now(),
      });
    }

    function aoErro(e: ErrorEvent) {
      gravar(
        e.message || "Erro sem mensagem",
        e.error instanceof Error ? e.error.stack : undefined,
      );
    }

    function aoRejeitar(e: PromiseRejectionEvent) {
      const motivo: unknown = e.reason;
      gravar(
        motivo instanceof Error ? motivo.message : String(motivo),
        motivo instanceof Error ? motivo.stack : undefined,
      );
    }

    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRejeitar);
    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeitar);
    };
  }, [uid]);
}
