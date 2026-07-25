import { useSyncExternalStore } from "react";

/** Bate ou não com a media query, atualizado ao vivo conforme a janela muda
 *  de tamanho (resize, rotação, DevTools). Ex.: `useMediaQuery("(max-width: 767px)")`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notificar) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notificar);
      return () => mql.removeEventListener("change", notificar);
    },
    () => window.matchMedia(query).matches,
  );
}
