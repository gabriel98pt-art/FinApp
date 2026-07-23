import { NavLink } from "react-router-dom";
import { ABAS } from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./TabBar.module.css";

/** Barra de abas horizontal do desktop, fixa abaixo do header. */
export default function TabBar() {
  // TVDE é opt-in por conta (seção 4.4)
  const showTvde = useCfgStore((s) => s.cfg.showTvde);
  const abas = ABAS.filter((a) => a.id !== "tvde" || showTvde);

  return (
    <nav className={`${styles.barra} material`} aria-label="Navegação principal">
      {abas.map(({ id, rota, titulo, Icone }) => (
        <NavLink
          key={id}
          to={rota}
          end={rota === "/"}
          className={({ isActive }) => `${styles.aba} ${isActive ? styles.ativa : ""}`}
        >
          <Icone size={16} aria-hidden />
          {titulo}
        </NavLink>
      ))}
    </nav>
  );
}
