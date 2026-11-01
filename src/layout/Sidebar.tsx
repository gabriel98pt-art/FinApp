import { NavLink } from "react-router-dom";
import { ABAS } from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./Sidebar.module.css";

/** Navegação de tablet/desktop: uma pílula de vidro à esquerda, só com ícones
 *  (VidroIpad). A aba ativa é um círculo branco; o nome aparece num tooltip no
 *  hover e no foco (data-nome, ver o CSS) e está sempre em `aria-label`. Não
 *  leva `title`: o tooltip nativo apareceria por cima do nosso. Quem manda na
 *  largura reservada é `--sidebar-w`, o mesmo token que desloca o conteúdo.
 *
 *  Sem marca aqui: o "FinApp" já está no Header ao lado. No mobile não
 *  aparece — lá a navegação é a MobileNav em baixo. */
export default function Sidebar() {
  // TVDE é opt-in por conta (seção 4.4)
  const showTvde = useCfgStore((s) => s.cfg.showTvde);
  // Veículo é o contrário: vem ligado e desliga-se em Definições › Veículo.
  const showVeiculo = useCfgStore((s) => s.cfg.showVeiculo);
  const abas = ABAS.filter(
    (a) =>
      // Definições abrem só pelo perfil (botão no topo).
      a.id !== "definicoes" && (a.id !== "tvde" || showTvde) && (a.id !== "veiculo" || showVeiculo),
  );
  return (
    <nav className={`${styles.barra} material`} aria-label="Navegação principal">
      <ul className={styles.lista}>
        {abas.map(({ id, rota, titulo, Icone }) => (
          <li key={id}>
            <NavLink
              to={rota}
              end={rota === "/"}
              className={({ isActive }) => `${styles.aba} ${isActive ? styles.ativa : ""}`}
              aria-label={titulo}
              data-nome={titulo}
            >
              <Icone size={20} aria-hidden className={styles.icone} />
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
