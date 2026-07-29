import { NavLink } from "react-router-dom";
import { ABAS } from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./Sidebar.module.css";

/** Navegação de tablet/desktop, fixa à esquerda. Segue o padrão de sidebar do
 *  iPadOS/macOS: em largura compacta (768-1023px) fica um rail só de ícones;
 *  a partir de 1024px expande com os rótulos. Quem manda na largura é
 *  `--sidebar-w`, o mesmo token que desloca o conteúdo à direita.
 *
 *  Sem marca aqui: o "FinApp" já está no Header ao lado. No mobile não
 *  aparece — lá a navegação é a MobileNav em baixo. */
export default function Sidebar() {
  // TVDE é opt-in por conta (seção 4.4)
  const showTvde = useCfgStore((s) => s.cfg.showTvde);
  const abas = ABAS.filter((a) => a.id !== "tvde" || showTvde);

  return (
    <nav className={`${styles.barra} material`} aria-label="Navegação principal">
      <ul className={styles.lista}>
        {abas.map(({ id, rota, titulo, Icone }) => (
          <li key={id}>
            <NavLink
              to={rota}
              end={rota === "/"}
              className={({ isActive }) => `${styles.aba} ${isActive ? styles.ativa : ""}`}
            >
              <Icone size={18} aria-hidden className={styles.icone} />
              {/* No rail o rótulo sai da vista mas fica no DOM: é ele que dá
                  nome ao link para o leitor de tela. */}
              <span className={styles.rotulo}>{titulo}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
