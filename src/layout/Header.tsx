import { useRef, useState } from "react";
import { Moon, Plus, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import MenuAcoesItem from "../components/MenuAcoesItem";
import NotificacoesSino from "../components/NotificacoesSino";
import SeletorMes from "../components/SeletorMes";
import { useAcaoHeaderStore } from "../stores/acaoHeaderStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useThemeStore } from "../stores/themeStore";
import { useTemaEfetivo } from "../hooks/useTemaEfetivo";
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
  const temaEfetivo = useTemaEfetivo();
  const definirTema = useThemeStore((s) => s.definirTema);

  // O "+" da página aberta (stores/acaoHeaderStore.ts). Cada tela regista o
  // seu ao montar e tira-o ao sair, portanto aqui só há que desenhar o que
  // estiver lá — ou nada, nas telas que não têm o que adicionar.
  const acao = useAcaoHeaderStore((s) => s.acao);
  const refAdicionar = useRef<HTMLButtonElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);

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
      {/* Desfazer e refazer saíram daqui em 31/08/2026: eram as duas únicas
          ações do header que não abriam nada, e cinco botões a 44 pontos não
          cabiam num telemóvel de 375. Agora vivem no menu "Mais" (telemóvel)
          e no fim da barra lateral (tablet/computador). */}
      <div className={styles.acoes}>
        {/* Primeiro da fila de propósito: é o único que aparece e desaparece
            conforme a tela, e pô-lo à frente deixa o tema e o sino sempre no
            mesmo sítio em vez de os empurrar de página para página. */}
        {acao && (
          <button
            ref={refAdicionar}
            className={`${styles.acao} ${styles.adicionar}`}
            onClick={() => (acao.acoes ? setMenuAberto(true) : acao.onClick?.())}
            aria-label={acao.rotulo}
            aria-haspopup={acao.acoes ? "menu" : undefined}
            aria-expanded={acao.acoes ? menuAberto : undefined}
          >
            <Plus size={19} aria-hidden />
          </button>
        )}
        <button
          className={styles.acao}
          onClick={() => definirTema(temaEfetivo === "dark" ? "light" : "dark")}
          aria-label={temaEfetivo === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          title="Este atalho fixa o tema, mesmo se estiver em Sistema — ajustável em Definições"
        >
          {temaEfetivo === "dark" ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>
        <NotificacoesSino />
      </div>

      {/* Telas com mais do que um tipo de "adicionar" (Veículo, Cartões): o
          "+" pergunta o quê em vez de adivinhar. Reusa o mesmo menu das
          pílulas e dos itens de lista — folha no telemóvel, popover ancorado
          no computador. */}
      {acao?.acoes && (
        <MenuAcoesItem
          aberta={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          titulo={acao.rotulo}
          ancoraRef={refAdicionar}
          acoes={acao.acoes}
        />
      )}
    </header>
  );
}
