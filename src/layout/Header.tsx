import { Moon, Redo2, Sun, Undo2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import NotificacoesSino from "../components/NotificacoesSino";
import SeletorMes from "../components/SeletorMes";
import { useHistoricoStore } from "../stores/historicoStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useThemeStore } from "../stores/themeStore";
import { podeDesfazer, podeRefazer } from "../utils/historico";
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
  "/calendario",
  "/transacoes",
  // Planejamento manda no seletor nas duas abas: o teto do mês é do mês
  // escolhido, e a meta de poupança também (foi /metas até serem fundidas).
  "/planejamento",
  // Estas duas tinham ficado de fora por "terem conceito próprio de período".
  // Têm — mas o mês do header é a referência de topo do app, e não o ter aqui
  // obrigava a adivinhar de que mês era o que se estava a ver.
  "/parcelas",
  "/tvde",
];

export default function Header() {
  const { pathname } = useLocation();
  const mes = useMesVisivelStore((s) => s.mes);
  const setMes = useMesVisivelStore((s) => s.setMes);
  const mostrarMes = ROTAS_COM_MES.includes(pathname);
  const theme = useThemeStore((s) => s.theme);
  const alternarTema = useThemeStore((s) => s.alternarTema);
  const podeUndo = useHistoricoStore((s) => podeDesfazer(s.pilha));
  const podeRedo = useHistoricoStore((s) => podeRefazer(s.pilha));
  const desfazer = useHistoricoStore((s) => s.desfazer);
  const refazer = useHistoricoStore((s) => s.refazer);

  return (
    <header className={`${styles.header} material`}>
      <h1 className={styles.logo}>
        Fin<span>App</span>
      </h1>
      {mostrarMes && (
        <div className={styles.mes}>
          <SeletorMes mes={mes} aoMudar={setMes} compacto />
        </div>
      )}
      <div className={styles.acoes}>
        <button
          className={styles.acao}
          onClick={() => void desfazer()}
          disabled={!podeUndo}
          aria-label="Desfazer"
          title="Desfazer"
        >
          <Undo2 size={17} aria-hidden />
        </button>
        <button
          className={styles.acao}
          onClick={() => void refazer()}
          disabled={!podeRedo}
          aria-label="Refazer"
          title="Refazer"
        >
          <Redo2 size={17} aria-hidden />
        </button>
        <button
          className={styles.acao}
          onClick={alternarTema}
          aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        >
          {theme === "dark" ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>
        <NotificacoesSino />
      </div>
    </header>
  );
}
