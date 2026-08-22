import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistenciaAdiada } from "./persistenciaAdiada";
import type { Theme } from "../types";

interface ThemeState {
  /** Preferência guardada — pode ser "system". Quem precisa do tema
   *  resolvido de verdade (nunca "system") usa `useTemaEfetivo`. */
  theme: Theme;
  definirTema: (theme: Theme) => void;
}

/** Tema local do aparelho (persistido). A preferência por conta (cfg.theme)
 *  será sincronizada quando a store de configuração chegar (Marco 2). */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      definirTema: (theme) => set({ theme }),
    }),
    { name: "finapp-tema", storage: persistenciaAdiada },
  ),
);
