import { useSyncExternalStore } from "react";
import { useThemeStore } from "../stores/themeStore";

function assinarSistema(aoMudar: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}

function lerSistema(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Resolve a preferência de tema (que pode ser "system") pro que se aplica
 *  de fato — nunca "system". Reage a mudança do tema do SO em tempo real
 *  via `matchMedia`, sem precisar de reload. */
export function useTemaEfetivo(): "dark" | "light" {
  const theme = useThemeStore((s) => s.theme);
  const sistema = useSyncExternalStore<"dark" | "light">(assinarSistema, lerSistema, () => "dark");
  return theme === "system" ? sistema : theme;
}
