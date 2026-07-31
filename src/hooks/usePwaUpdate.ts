import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { mostrarToast } from "../stores/toastStore";
import { usePwaStore } from "../stores/pwaStore";

// O `registerType: "autoUpdate"` do vite.config só descreve o que fazer QUANDO
// uma versão nova é encontrada — não faz ninguém procurar por ela. Sem este
// registro explícito, quem decide checar é o navegador, e no iOS um app
// instalado volta da suspensão sem tocar na rede: daí o "abri e fechei várias
// vezes e continua velho". Aqui a checagem é pedida à mão sempre que o app
// volta ao primeiro plano.
//
// Nesse modo o `needRefresh` nunca chega (é o aviso de "há versão à espera de
// confirmação", e aqui nada espera confirmação): o worker novo assume sozinho
// e é o `onNeedReload` que avisa. Sem esse gancho, a página recarregava seca,
// sem toast e sem ninguém para dizer ao puxar-para-recarregar que a
// atualização já está a ser tratada.

/** Espera antes de recarregar: só o tempo de o toast ser lido. */
const MS_ANTES_DE_RECARREGAR = 1000;

export function usePwaUpdate() {
  useRegisterSW({
    onRegisteredSW(_url, r) {
      // O registro fica no store para o puxar-para-recarregar poder pedir a
      // mesma checagem sem registar o worker outra vez.
      usePwaStore.getState().definirRegistro(r ?? null);
      // Uma checagem já no arranque: a sessão pode ter começado com o app
      // aberto há dias.
      void r?.update();
    },
    onNeedReload() {
      if (usePwaStore.getState().aplicando) return;
      // Marcar antes do toast: é este sinal que diz a quem forçou a checagem
      // (o puxar-para-recarregar) que a atualização é tratada aqui.
      usePwaStore.getState().marcarAplicando();
      mostrarToast("Nova versão — atualizando…");
      setTimeout(() => window.location.reload(), MS_ANTES_DE_RECARREGAR);
    },
  });

  useEffect(() => {
    function checar() {
      if (document.visibilityState === "visible") void usePwaStore.getState().registro?.update();
    }
    // No iOS, tirar o app da suspensão dispara visibilitychange — é este o
    // gancho que faltava para o "reabri o app" realmente ir buscar versão.
    document.addEventListener("visibilitychange", checar);
    return () => document.removeEventListener("visibilitychange", checar);
  }, []);
}
