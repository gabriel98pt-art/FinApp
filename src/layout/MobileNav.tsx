import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { abasMenuMais, abasNavMobile } from "../constants/abas";
import styles from "./MobileNav.module.css";

/** Barra de navegação mobile: flutuante, arredondada, com "bolha" elevada na
 *  aba ativa e botão "Mais" para as abas secundárias (seção 6). */
export default function MobileNav() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();

  // showTvde fixo em false até a store de configuração (Marco 2)
  const principais = abasNavMobile(false);
  const secundarias = abasMenuMais(false);
  const maisAtivo = secundarias.some((a) => a.rota === pathname);

  return (
    <>
      <div
        className={`${styles.veu} ${maisAberto ? styles.veuVisivel : ""}`}
        onClick={() => setMaisAberto(false)}
        aria-hidden
      />

      <div className={`${styles.menuMais} material ${maisAberto ? styles.menuAberto : ""}`}>
        {secundarias.map(({ id, rota, titulo, Icone }) => (
          <NavLink
            key={id}
            to={rota}
            className={({ isActive }) =>
              `${styles.itemMais} ${isActive ? styles.itemMaisAtivo : ""}`
            }
            onClick={() => setMaisAberto(false)}
          >
            <Icone size={18} aria-hidden />
            {titulo}
          </NavLink>
        ))}
      </div>

      <nav className={`${styles.barra} material`} aria-label="Navegação principal">
        {principais.map(({ id, rota, titulo, Icone }) => (
          <NavLink
            key={id}
            to={rota}
            end={rota === "/"}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.ativo : ""}`}
            onClick={() => setMaisAberto(false)}
          >
            <span className={styles.bolha}>
              <Icone size={20} aria-hidden />
            </span>
            <span className={styles.rotulo}>{titulo}</span>
          </NavLink>
        ))}

        <button
          className={`${styles.item} ${maisAtivo ? styles.ativo : ""}`}
          onClick={() => setMaisAberto(!maisAberto)}
          aria-expanded={maisAberto}
          aria-label="Mais abas"
        >
          <span className={styles.bolha}>
            <MoreHorizontal size={20} aria-hidden />
          </span>
          <span className={styles.rotulo}>Mais</span>
        </button>
      </nav>
    </>
  );
}
