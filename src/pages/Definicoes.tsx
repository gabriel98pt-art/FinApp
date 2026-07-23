import { CarTaxiFront, LogOut, Moon, Sun } from "lucide-react";
import Pagina, { EmConstrucao } from "../components/Pagina";
import { sair } from "../services/authService";
import { atualizarConfig } from "../services/cfgService";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { useThemeStore } from "../stores/themeStore";
import styles from "./Definicoes.module.css";

export default function Definicoes() {
  const sessao = useAuthStore((s) => s.sessao);
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);
  const showTvde = useCfgStore((s) => s.cfg.showTvde);

  async function alternarTvde() {
    if (!sessao) return;
    try {
      await atualizarConfig(sessao.uid, { showTvde: !showTvde });
      mostrarToast(showTvde ? "Módulo TVDE desligado" : "✓ Módulo TVDE ligado");
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  return (
    <Pagina titulo="Definições">
      <div className={styles.grupo}>
        <button className={styles.linha} onClick={alternarTema}>
          {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          Tema: {theme === "dark" ? "escuro" : "claro"} (tocar para alternar)
        </button>
        <button className={styles.linha} onClick={() => void alternarTvde()}>
          <CarTaxiFront size={18} aria-hidden />
          Módulo TVDE: {showTvde ? "ligado" : "desligado"} (tocar para alternar)
        </button>
      </div>

      <EmConstrucao>Moeda da conta, categorias, modo discreto e backup — Parte 3</EmConstrucao>

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
