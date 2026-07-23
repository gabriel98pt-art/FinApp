import { NavLink } from "react-router-dom";
import { ABAS } from "../constants/abas";
import styles from "./TabBar.module.css";

/** Barra de abas horizontal do desktop, fixa abaixo do header. */
export default function TabBar() {
  return (
    <nav className={`${styles.barra} material`} aria-label="Navegação principal">
      {ABAS.map(({ id, rota, titulo, Icone }) => (
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
