import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../stores/themeStore";
import styles from "./Header.module.css";

export default function Header() {
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);

  return (
    <header className={`${styles.header} material`}>
      <h1 className={styles.logo}>
        Fin<span>App</span>
      </h1>
      <button
        className={styles.acao}
        onClick={alternarTema}
        aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  );
}
