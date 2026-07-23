import { useEffect } from "react";
import { useThemeStore } from "../stores/themeStore";

/** Reflete o tema da store no <html data-theme> e na cor da barra do sistema. */
export function useAplicarTema() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0A1622" : "#F5F7FA";
  }, [theme]);
}
