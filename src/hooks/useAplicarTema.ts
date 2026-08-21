import { useEffect } from "react";
import { useTemaEfetivo } from "./useTemaEfetivo";

/** Reflete o tema (já resolvido, nunca "system") no <html data-theme> e na
 *  cor da barra do sistema. */
export function useAplicarTema() {
  const tema = useTemaEfetivo();

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = tema === "dark" ? "#0A1622" : "#F5F7FA";
  }, [tema]);
}
