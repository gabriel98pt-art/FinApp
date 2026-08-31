import { NavLink } from "react-router-dom";
import { Redo2, Undo2 } from "lucide-react";
import { ABAS } from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import { useHistoricoStore } from "../stores/historicoStore";
import { podeDesfazer, podeRefazer } from "../utils/historico";
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
            >
              <Icone size={18} aria-hidden className={styles.icone} />
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
          title="Desfazer"
        >
          <Undo2 size={18} aria-hidden className={styles.icone} />
          <span className={styles.rotulo}>Desfazer</span>
        </button>
        <button
          className={styles.aba}
          onClick={() => void refazer()}
          disabled={!podeRedo}
          aria-label="Refazer"
          title="Refazer"
        >
          <Redo2 size={18} aria-hidden className={styles.icone} />
          <span className={styles.rotulo}>Refazer</span>
        </button>
      </div>
    </nav>
  );
}
