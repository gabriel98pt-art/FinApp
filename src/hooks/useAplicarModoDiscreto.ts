import { useEffect } from "react";
import { useCfgStore } from "../stores/cfgStore";

/** Reflete cfg.modoDiscreto (seção 4.6) no <html data-discreto>, pra qualquer
 *  elemento com a classe global .discreto borrar via CSS. */
export function useAplicarModoDiscreto() {
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);

  useEffect(() => {
    document.documentElement.dataset.discreto = modoDiscreto ? "true" : "false";
  }, [modoDiscreto]);
}
