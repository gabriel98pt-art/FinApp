import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types";

interface ThemeState {
  theme: Theme;
  alternarTema: () => void;
}

/** Tema local do aparelho (persistido). A preferência por conta (cfg.theme)
 *  será sincronizada quando a store de configuração chegar (Marco 2). */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      alternarTema: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    { name: "finapp-tema" },
  ),
);
