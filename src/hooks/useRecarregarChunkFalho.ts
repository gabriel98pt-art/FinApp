import { useEffect } from "react";
import { mostrarToast } from "../stores/toastStore";

/** Depois de um novo deploy, o JS já carregado na aba continua a apontar para
 *  os chunks com o hash ANTIGO — e o Vercel só serve os ficheiros do deploy
 *  ATUAL. Qualquer `import()` dinâmico feito a partir daí (entrar numa
 *  página, ou o pdf.js da importação de extrato) falha com "Importing a
 *  module script failed" / "Failed to fetch dynamically imported module",
 *  mesmo com a ligação boa — foi o que aconteceu à Transações em 06/08 e à
 *  importação de PDF em 08/08 (ver Definições → Erros recentes).
 *
 *  O `usePwaUpdate` já cobre isto quando o app volta de segundo plano
 *  (`visibilitychange`), mas não pega o caso de a aba ficar aberta e em
 *  primeiro plano bem no momento de um deploy — sem isto, o usuário só via um
 *  erro genérico ("verifique a ligação") que não tinha nada a ver com o que
 *  realmente aconteceu.
 *
 *  `vite:preloadError` é o evento que o próprio Vite dispara sempre que um
 *  `import()` dinâmico falha assim — cobre TODO import dinâmico do bundle,
 *  não só as rotas com `lazy()`. `preventDefault()` evita o erro solto no
 *  console (que `useCapturarErros` gravaria como crash) e recarrega sozinho,
 *  como já acontece quando uma nova versão é detetada em segundo plano. */
export function useRecarregarChunkFalho() {
  useEffect(() => {
    function aoFalhar(e: Event) {
      e.preventDefault();
      // Guarda de loop: se o reload não resolver (deploy quebrado, offline de
      // verdade), fica só a um recarregamento por aba, não recarrega sem
      // parar — as próximas falhas caem no erro normal de cada sítio.
      if (sessionStorage.getItem("chunk-recarregado")) return;
      sessionStorage.setItem("chunk-recarregado", "1");
      mostrarToast("Nova versão — atualizando…");
      setTimeout(() => window.location.reload(), 1000);
    }
    window.addEventListener("vite:preloadError", aoFalhar);
    return () => window.removeEventListener("vite:preloadError", aoFalhar);
  }, []);
}
