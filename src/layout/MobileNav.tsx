import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import {
  ABAS_MENU_MAIS,
  NAV_MOBILE_DIREITA,
  NAV_MOBILE_ESQUERDA,
  type AbaDef,
} from "../constants/abas";
import { useCfgStore } from "../stores/cfgStore";
import { useUiStore } from "../stores/uiStore";
import styles from "./MobileNav.module.css";

/** Os quatro destinos da barra, por onde o círculo da aba ativa desliza. */
type Destino = AbaDef["id"] | "mais";

function ItemAba({
  aba,
  pathname,
  aoNavegar,
}: {
  aba: AbaDef;
  pathname: string;
  aoNavegar: () => void;
}) {
  const { rota, titulo, Icone } = aba;
  return (
    <NavLink
      data-destino={aba.id}
      to={rota}
      end={rota === "/"}
      className={({ isActive }) => `${styles.item} ${isActive ? styles.ativo : ""}`}
      onClick={(e: MouseEvent) => {
        aoNavegar();
        // Tocar na aba em que já se está leva ao topo, como no iOS.
        if (pathname === rota) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
      title={titulo}
    >
      <Icone size={20} aria-hidden />
      <span className={styles.rotulo}>{titulo}</span>
    </NavLink>
  );
}

/** Barra de navegação mobile: Início | Receitas | [+] | Despesas | Mais. A aba
 *  ativa é um círculo de 44px que desliza (mola sem ressalto) entre os quatro
 *  destinos; o «+» central nunca é destino, por isso o círculo não passa por
 *  ele. «Mais» abre uma folha que sobe de baixo, como os outros menus. */
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

  const fixas = [...NAV_MOBILE_ESQUERDA, ...NAV_MOBILE_DIREITA];
  const ativo: Destino | null =
    fixas.find((a) => (a.rota === "/" ? pathname === "/" : pathname === a.rota))?.id ??
    (maisAtivo ? "mais" : null);

  const barra = useRef<HTMLElement>(null);
  const circulo = useRef<HTMLSpanElement>(null);
  const [pronto, setPronto] = useState(false);

  // Posiciona o círculo sobre o item ativo; refaz ao redimensionar (a barra
  // tem largura em % do ecrã). A transição só liga depois da 1.ª medida, para
  // o círculo não "voar" desde a esquerda ao abrir o app.
  useLayoutEffect(() => {
    const el = circulo.current;
    if (!el) return;
    const colocar = () => {
      const alvo = barra.current?.querySelector<HTMLElement>(`[data-destino="${ativo}"]`);
      if (!alvo) return;
      el.style.transform = `translateX(${alvo.offsetLeft + (alvo.offsetWidth - el.offsetWidth) / 2}px)`;
    };
    colocar();
    setPronto(true);
    window.addEventListener("resize", colocar);
    return () => window.removeEventListener("resize", colocar);
  }, [ativo]);

  return (
    <>
      <BottomSheet aberta={maisAberto} aoFechar={fecharMais} titulo="Mais">
        <div className={styles.menuMais}>
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
        </div>
      </BottomSheet>

      <nav ref={barra} className={`${styles.barra} material`} aria-label="Navegação principal">
        <span
          ref={circulo}
          className={`${styles.circulo} ${pronto ? styles.circuloAnima : ""} ${
            ativo ? "" : styles.circuloOculto
          }`}
          aria-hidden
        />

        {NAV_MOBILE_ESQUERDA.map((a) => (
          <ItemAba key={a.id} aba={a} pathname={pathname} aoNavegar={fecharMais} />
        ))}

        <div className={styles.slotCentral}>
          <button
            className={styles.central}
            onClick={() => {
              fecharMais();
              abrirMenuRegistro();
            }}
            aria-label="Registo rápido"
          >
            <Plus size={24} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {NAV_MOBILE_DIREITA.map((a) => (
          <ItemAba key={a.id} aba={a} pathname={pathname} aoNavegar={fecharMais} />
        ))}

        <button
          data-destino="mais"
          className={`${styles.item} ${maisAtivo ? styles.ativo : ""}`}
          onClick={() => setMaisAberto(!maisAberto)}
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          aria-label="Mais abas"
          title="Mais"
        >
          <MoreHorizontal size={20} aria-hidden />
          <span className={styles.rotulo}>Mais</span>
        </button>
      </nav>
    </>
  );
}
