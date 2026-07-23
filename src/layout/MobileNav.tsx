import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  ABAS_MENU_MAIS,
  NAV_MOBILE_DIREITA,
  NAV_MOBILE_ESQUERDA,
  type AbaDef,
} from "../constants/abas";
import { useUiStore } from "../stores/uiStore";
import styles from "./MobileNav.module.css";

function ItemAba({ aba, aoNavegar }: { aba: AbaDef; aoNavegar: () => void }) {
  const { rota, titulo, Icone } = aba;
  return (
    <NavLink
      to={rota}
      end={rota === "/"}
      className={({ isActive }) => `${styles.item} ${isActive ? styles.ativo : ""}`}
      onClick={aoNavegar}
    >
      <Icone size={20} aria-hidden />
      <span className={styles.rotulo}>{titulo}</span>
    </NavLink>
  );
}

/** Barra de navegação mobile (Marco 2): Receitas | Despesas | [botão central
 *  de registro rápido, sempre elevado] | Início | Mais. Aba ativa recebe só um
 *  destaque suave atrás do ícone+texto (estilo iOS), sem bolha. */
export default function MobileNav() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  const maisAtivo = ABAS_MENU_MAIS.some((a) => a.rota === pathname);
  const fecharMais = () => setMaisAberto(false);

  return (
    <>
      <div
        className={`${styles.veu} ${maisAberto ? styles.veuVisivel : ""}`}
        onClick={fecharMais}
        aria-hidden
      />

      <div className={`${styles.menuMais} ${maisAberto ? styles.menuAberto : ""}`}>
        {ABAS_MENU_MAIS.map(({ id, rota, titulo, Icone }) => (
          <NavLink
            key={id}
            to={rota}
            className={({ isActive }) =>
              `${styles.itemMais} ${isActive ? styles.itemMaisAtivo : ""}`
            }
            onClick={fecharMais}
          >
            <Icone size={18} aria-hidden />
            {titulo}
          </NavLink>
        ))}
      </div>

      <nav className={`${styles.barra} material`} aria-label="Navegação principal">
        {NAV_MOBILE_ESQUERDA.map((a) => (
          <ItemAba key={a.id} aba={a} aoNavegar={fecharMais} />
        ))}

        <div className={styles.slotCentral}>
          <button
            className={styles.central}
            onClick={() => {
              fecharMais();
              abrirRegistro();
            }}
            aria-label="Registro rápido"
          >
            <Plus size={26} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {NAV_MOBILE_DIREITA.map((a) => (
          <ItemAba key={a.id} aba={a} aoNavegar={fecharMais} />
        ))}

        <button
          className={`${styles.item} ${maisAtivo ? styles.ativo : ""}`}
          onClick={() => setMaisAberto(!maisAberto)}
          aria-expanded={maisAberto}
          aria-label="Mais abas"
        >
          <MoreHorizontal size={20} aria-hidden />
          <span className={styles.rotulo}>Mais</span>
        </button>
      </nav>
    </>
  );
}
