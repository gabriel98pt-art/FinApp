import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { mostrarToast } from "../stores/toastStore";

// O `registerType: "autoUpdate"` do vite.config só descreve o que fazer QUANDO
// uma versão nova é encontrada — não faz ninguém procurar por ela. Sem este
// registro explícito, quem decide checar é o navegador, e no iOS um app
// instalado volta da suspensão sem tocar na rede: daí o "abri e fechei várias
// vezes e continua velho". Aqui a checagem é pedida à mão sempre que o app
// volta ao primeiro plano.

/** Espera antes de recarregar: só o tempo de o toast ser lido. */
const MS_ANTES_DE_RECARREGAR = 1000;

export function usePwaUpdate() {
  const registro = useRef<ServiceWorkerRegistration | null>(null);
  const jaAtualizando = useRef(false);

  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registro.current = r ?? null;
      // Uma checagem já no arranque: a sessão pode ter começado com o app
      // aberto há dias.
      void r?.update();
    },
  });

  useEffect(() => {
    function checar() {
      if (document.visibilityState === "visible") void registro.current?.update();
    }
    // No iOS, tirar o app da suspensão dispara visibilitychange — é este o
    // gancho que faltava para o "reabri o app" realmente ir buscar versão.
    document.addEventListener("visibilitychange", checar);
    return () => document.removeEventListener("visibilitychange", checar);
  }, []);

  useEffect(() => {
    if (!precisaAtualizar || jaAtualizando.current) return;
    jaAtualizando.current = true;
    mostrarToast("Nova versão — atualizando…");
    const t = setTimeout(() => void updateServiceWorker(true), MS_ANTES_DE_RECARREGAR);
    return () => clearTimeout(t);
  }, [precisaAtualizar, updateServiceWorker]);
}
