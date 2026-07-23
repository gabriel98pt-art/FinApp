import { LogOut, Moon, Sun } from "lucide-react";
import Pagina, { EmConstrucao } from "../components/Pagina";
import { sair } from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import styles from "./Definicoes.module.css";

export default function Definicoes() {
  const sessao = useAuthStore((s) => s.sessao);
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);

  return (
    <Pagina titulo="Definições">
      <div className={styles.grupo}>
        <button className={styles.linha} onClick={alternarTema}>
          {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          Tema: {theme === "dark" ? "escuro" : "claro"} (tocar para alternar)
        </button>
      </div>

      <EmConstrucao>
        Moeda da conta, categorias, cartões, TVDE, modo discreto e backup — Marco 2/3
      </EmConstrucao>

      <div className={styles.grupo}>
        <p className={styles.conta}>Sessão: {sessao?.email ?? "—"}</p>
        <button className={`${styles.linha} ${styles.sair}`} onClick={() => void sair()}>
          <LogOut size={18} aria-hidden />
          Sair da conta
        </button>
      </div>
    </Pagina>
  );
}
