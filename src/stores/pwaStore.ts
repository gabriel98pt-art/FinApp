import { create } from "zustand";

// Ponte entre o usePwaUpdate — que vive no App.tsx e é o único a falar com o
// service worker — e quem, mais abaixo na árvore, precisa forçar uma checagem
// (hoje o puxar-para-recarregar do AppShell). Sem isto, o gesto teria de
// registar o worker outra vez só para o poder atualizar: duas versões da mesma
// lógica, o caminho que já deu bug uma vez.

interface PwaState {
  /** Registro do service worker, assim que o usePwaUpdate o recebe. */
  registro: ServiceWorkerRegistration | null;
  /** O usePwaUpdate já viu versão nova e trata de aplicar e recarregar. */
  aplicando: boolean;
  definirRegistro: (registro: ServiceWorkerRegistration | null) => void;
  marcarAplicando: () => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  registro: null,
  aplicando: false,
  definirRegistro: (registro) => set({ registro }),
  marcarAplicando: () => set({ aplicando: true }),
}));

/** Quanto esperar pelo `needRefresh` depois de a checagem terminar. */
const MS_ESPERA_VERSAO = 1500;

/**
 * Pede ao service worker uma checagem de verdade e diz se há versão nova a
 * caminho. `true` significa que o usePwaUpdate assume daqui — mostra o toast e
 * recarrega —, portanto quem chamou não deve recarregar por conta própria.
 */
export async function checarVersaoNova(msEspera = MS_ESPERA_VERSAO): Promise<boolean> {
  if (usePwaStore.getState().aplicando) return true;

  const { registro } = usePwaStore.getState();
  if (!registro) return false;

  try {
    await registro.update();
  } catch {
    // Sem rede, ou o navegador recusou a checagem: não há nada a esperar.
    return false;
  }
  if (usePwaStore.getState().aplicando) return true;

  // `update()` resolve quando a checagem termina, mas o `needRefresh` do
  // useRegisterSW só chega depois de o worker novo instalar — daí a espera.
  return new Promise((resolve) => {
    const parar = usePwaStore.subscribe((estado) => {
      if (!estado.aplicando) return;
      clearTimeout(t);
      parar();
      resolve(true);
    });
    const t = setTimeout(() => {
      parar();
      resolve(false);
    }, msEspera);
  });
}
