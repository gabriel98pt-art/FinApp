import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, Plus, Redo2, Undo2 } from "lucide-react";
import {
  ABAS_MENU_MAIS,
  NAV_MOBILE_DIREITA,
  NAV_MOBILE_ESQUERDA,
  type AbaDef,
} from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import { useHistoricoStore } from "../stores/historicoStore";
import { useUiStore } from "../stores/uiStore";
import { estiloBotaoRegistro } from "../utils/corBotaoRegistro";
import { podeDesfazer, podeRefazer } from "../utils/historico";
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
  const abrirMenuRegistro = useUiStore((s) => s.abrirMenuRegistro);
  const cfg = useCfgStore((s) => s.cfg);
  // TVDE é opt-in por conta (seção 4.4)
  const showTvde = cfg.showTvde;
  // Veículo é o contrário: vem ligado e desliga-se em Definições › Veículo.
  const showVeiculo = cfg.showVeiculo;

  const abasMais = ABAS_MENU_MAIS.filter(
    (a) => (a.id !== "tvde" || showTvde) && (a.id !== "veiculo" || showVeiculo),
  );
  const maisAtivo = abasMais.some((a) => a.rota === pathname);
  const fecharMais = () => setMaisAberto(false);

  // Desfazer/refazer viviam no cabeçalho até 31/08/2026 — saíram de lá porque
  // cinco ícones a 44 pontos não cabem num telemóvel de 375. A lógica é a
  // mesma de antes, só mudou onde o botão vive.
  const podeUndo = useHistoricoStore((s) => podeDesfazer(s.pilha));
  const podeRedo = useHistoricoStore((s) => podeRefazer(s.pilha));
  const desfazer = useHistoricoStore((s) => s.desfazer);
  const refazer = useHistoricoStore((s) => s.refazer);

  /** Ação instantânea: fecha o menu e só depois corre, para que o resultado
   *  (e o aviso "↩ Desfeito") apareça na tela, não por trás do véu. */
  function acao(fn: () => Promise<void>) {
    return () => {
      fecharMais();
      void fn();
    };
  }

  return (
    <>
      <div
        className={`${styles.veu} ${maisAberto ? styles.veuVisivel : ""}`}
        onClick={fecharMais}
        aria-hidden
      />

      <div
        className={`${styles.menuMais} ${maisAberto ? styles.menuAberto : ""}`}
        // `inert`, mesmo padrão do BottomSheet/ConfirmarAcao (achado da
        // auditoria de Acessibilidade): fechado, o menu só ficava com
        // opacity:0 — os links continuavam na ordem do Tab em TODA tela
        // mobile do app, a plataforma principal dele. `inert` tira-os da
        // navegação e da árvore de acessibilidade enquanto está fechado.
        inert={!maisAberto}
      >
        {abasMais.map(({ id, rota, titulo, Icone }) => (
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

        {/* Secção à parte, e não mais duas entradas na lista: as de cima são
            destinos (levam a uma aba), estas fazem alguma coisa e o menu
            fecha-se logo. Os filhos ficam TODOS diretos do menu — envolver as
            abas num <div> partiria o `inert`, que é lido a partir daqui. */}
        <span className={styles.tituloSecao}>Ações</span>
        <button
          className={styles.itemMais}
          onClick={acao(desfazer)}
          disabled={!podeUndo}
          aria-label="Desfazer"
        >
          <Undo2 size={18} aria-hidden />
          Desfazer
        </button>
        <button
          className={styles.itemMais}
          onClick={acao(refazer)}
          disabled={!podeRedo}
          aria-label="Refazer"
        >
          <Redo2 size={18} aria-hidden />
          Refazer
        </button>
      </div>

      <nav className={`${styles.barra} material`} aria-label="Navegação principal">
        {NAV_MOBILE_ESQUERDA.map((a) => (
          <ItemAba key={a.id} aba={a} aoNavegar={fecharMais} />
        ))}

        <div className={styles.slotCentral}>
          <button
            className={styles.central}
            style={estiloBotaoRegistro(cfg, pathname)}
            onClick={() => {
              fecharMais();
              abrirMenuRegistro();
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
