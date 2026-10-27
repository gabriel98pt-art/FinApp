import { NavLink } from "react-router-dom";
import { Redo2, Undo2 } from "lucide-react";
import { ABAS } from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import { useHistoricoStore } from "../stores/historicoStore";
import { podeDesfazer, podeRefazer } from "../utils/historico";
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
    (a) => (a.id !== "tvde" || showTvde) && (a.id !== "veiculo" || showVeiculo),
  );
  // Desfazer/refazer saíram do cabeçalho em 31/08/2026. No telemóvel foram
  // para o menu "Mais"; aqui é o equivalente de tablet/computador, senão
  // ficavam sem sítio nenhum nesses ecrãs (a barra de baixo não existe lá).
  const podeUndo = useHistoricoStore((s) => podeDesfazer(s.pilha));
  const podeRedo = useHistoricoStore((s) => podeRefazer(s.pilha));
  const desfazer = useHistoricoStore((s) => s.desfazer);
  const refazer = useHistoricoStore((s) => s.refazer);

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

      {/* Fora da lista de abas de propósito: estas duas não levam a lado
          nenhum, fazem alguma coisa na hora. */}
      <div className={styles.acoes} role="group" aria-label="Ações">
        <button
          className={styles.aba}
          onClick={() => void desfazer()}
          disabled={!podeUndo}
          aria-label="Desfazer"
          data-nome="Desfazer"
        >
          <Undo2 size={20} aria-hidden className={styles.icone} />
          <span className={styles.rotulo}>Desfazer</span>
        </button>
        <button
          className={styles.aba}
          onClick={() => void refazer()}
          disabled={!podeRedo}
          aria-label="Refazer"
          data-nome="Refazer"
        >
          <Redo2 size={20} aria-hidden className={styles.icone} />
          <span className={styles.rotulo}>Refazer</span>
        </button>
      </div>
    </nav>
  );
}
