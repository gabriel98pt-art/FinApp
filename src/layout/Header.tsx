import { Eye, EyeOff } from "lucide-react";
import { useLocation } from "react-router-dom";
import NotificacoesSino from "../components/NotificacoesSino";
import SeletorMes from "../components/SeletorMes";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { mostrarToast } from "../stores/toastStore";
import { atualizarConfig } from "../services/cfgService";
import styles from "./Header.module.css";

/** Rotas cujo conteúdo é por mês — só nelas o seletor aparece (item 1). O
 *  Header é renderizado uma vez em AppShell, fora do <Outlet>, então o mês
 *  fica sempre visível em vez de rolar junto com a página. */
const ROTAS_COM_MES = [
  "/",
  "/receitas",
  "/despesas",
  "/cartoes",
  "/veiculo",
  // Planejamento manda no seletor nas duas abas: o teto do mês é do mês
  // escolhido, e a meta de poupança também (foi /metas até serem fundidas).
  "/planejamento",
  "/analise",
  // Estas duas tinham ficado de fora por "terem conceito próprio de período".
  // Têm — mas o mês do header é a referência de topo do app, e não o ter aqui
  // obrigava a adivinhar de que mês era o que se estava a ver.
  "/tvde",
];

export default function Header() {
  const { pathname } = useLocation();
  const mes = useMesVisivelStore((s) => s.mes);
  const setMes = useMesVisivelStore((s) => s.setMes);
  const mostrarMes = ROTAS_COM_MES.includes(pathname);
  const uid = useAuthStore((s) => s.sessao?.uid);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);

  /** Mesmo campo e mesmo gesto do interruptor "Modo discreto" em Definições —
   *  aqui é o atalho para o esconder valores em público. O tema deixou de ter
   *  atalho no cabeçalho; continua em Definições → Aparência. */
  async function alternarModoDiscreto() {
    if (!uid) return;
    try {
      await atualizarConfig(uid, { modoDiscreto: !modoDiscreto });
    } catch {
      mostrarToast("Não foi possível alterar.");
    }
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.logo}>
        Fin<span>App</span>
      </h1>
      {mostrarMes && (
        <div className={styles.mes}>
          <SeletorMes mes={mes} aoMudar={setMes} compacto />
        </div>
      )}
      {/* Desfazer e refazer saíram daqui em 31/08/2026: eram as duas únicas
          ações do header que não abriam nada, e cinco botões a 44 pontos não
          cabiam num telemóvel de 375. Agora vivem no menu "Mais" (telemóvel)
          e no fim da barra lateral (tablet/computador). */}
      <div className={styles.acoes}>
        <button
          className={styles.acao}
          onClick={() => void alternarModoDiscreto()}
          aria-label={modoDiscreto ? "Mostrar valores" : "Ocultar valores"}
          aria-pressed={modoDiscreto}
        >
          {modoDiscreto ? (
            <EyeOff size={20} strokeWidth={1.75} aria-hidden />
          ) : (
            <Eye size={20} strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <NotificacoesSino />
      </div>
    </header>
  );
}
