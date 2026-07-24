import { Moon, Redo2, Sun, Undo2 } from "lucide-react";
import { useHistoricoStore } from "../stores/historicoStore";
import { useThemeStore } from "../stores/themeStore";
import { podeDesfazer, podeRefazer } from "../utils/historico";
import styles from "./Header.module.css";

export default function Header() {
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);
  const podeUndo = useHistoricoStore((s) => podeDesfazer(s.pilha));
  const podeRedo = useHistoricoStore((s) => podeRefazer(s.pilha));
  const desfazer = useHistoricoStore((s) => s.desfazer);
  const refazer = useHistoricoStore((s) => s.refazer);

  return (
    <header className={`${styles.header} material`}>
      <h1 className={styles.logo}>
        Fin<span>App</span>
      </h1>
      <div className={styles.acoes}>
        <button
          className={styles.acao}
          onClick={() => void desfazer()}
          disabled={!podeUndo}
          aria-label="Desfazer"
          title="Desfazer"
        >
          <Undo2 size={19} />
        </button>
        <button
          className={styles.acao}
          onClick={() => void refazer()}
          disabled={!podeRedo}
          aria-label="Refazer"
          title="Refazer"
        >
          <Redo2 size={19} />
        </button>
        <button
          className={styles.acao}
          onClick={alternarTema}
          aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
