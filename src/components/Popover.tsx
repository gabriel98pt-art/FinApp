import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { posicionarPopover, type PosicaoPopover } from "../utils/popover";
import styles from "./Popover.module.css";

/** Caixa pequena ancorada ao elemento que a abriu, como um `<select>` nativo:
 *  abre por baixo, vira para cima quando não há espaço, e nunca sai da janela.
 *
 *  É o par de desktop da `BottomSheet` — ver `FolhaAncorada`, que escolhe entre
 *  as duas. Aqui não há véu escuro nem pegador de arrasto: cobrir o ecrã todo
 *  para escolher uma opção é peso a mais quando o ponteiro já está no sítio, e
 *  puxar para fechar é gesto de dedo.
 *
 *  Fechado não renderiza nada. Isso importa na revisão de um extrato, onde há
 *  dois seletores POR LINHA — nenhuma lista existe até alguém abrir uma. */
export default function Popover({
  aberta,
  aoFechar,
  titulo,
  ancoraRef,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** Nome acessível da caixa. Não é mostrado: o gatilho ao lado já diz o que
   *  isto é, e um cabeçalho num popover deste tamanho é bulk. */
  titulo: string;
  /** O elemento a que a caixa se cola — normalmente o botão que a abriu. */
  ancoraRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PosicaoPopover | null>(null);

  // Ao fechar, esquece o sítio. A abertura seguinte pode ser noutro gatilho, e
  // medir a caixa ainda com o `max-height` da vez anterior daria uma decisão
  // errada sobre caber ou não por baixo. Ajuste durante o render, como o
  // `jaAbriu` da BottomSheet — num efeito seria uma renderização em cascata.
  const [eraAberta, setEraAberta] = useState(aberta);
  if (eraAberta !== aberta) {
    setEraAberta(aberta);
    if (!aberta) setPos(null);
  }

  // Medir depois de montar e antes de pintar: a caixa é renderizada fora da
  // vista (pos === null) só para se saber o tamanho dela, e só então recebe o
  // sítio definitivo. Sem isto não há como decidir se cabe por baixo.
  useLayoutEffect(() => {
    if (!aberta) return;

    function posicionar() {
      const ancora = ancoraRef.current;
      const caixa = caixaRef.current;
      if (!ancora || !caixa) return;

      const r = ancora.getBoundingClientRect();
      setPos(
        posicionarPopover(
          r,
          { largura: caixa.offsetWidth, altura: caixa.offsetHeight },
          {
            // `clientWidth` do html, e não `innerWidth`: este não conta a barra
            // de rolagem, e a caixa ficaria a transbordar por baixo dela.
            largura: document.documentElement.clientWidth,
            altura: document.documentElement.clientHeight,
          },
        ),
      );
    }

    posicionar();

    // A página por baixo continua a rolar (não há véu a segurá-la): a caixa
    // acompanha o gatilho em vez de ficar pendurada onde estava. `true` apanha
    // o scroll de qualquer contentor, não só o da janela.
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberta, ancoraRef]);

  // Fecha com Esc ou com um clique fora — o que o véu fazia na folha. O clique
  // no próprio gatilho fica de fora: quem o trata é o onClick dele, senão o
  // fecho daqui e a abertura de lá anulavam-se.
  useEffect(() => {
    if (!aberta) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    const aoApontar = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixaRef.current?.contains(alvo)) return;
      if (ancoraRef.current?.contains(alvo)) return;
      aoFechar();
    };

    window.addEventListener("keydown", aoTeclar);
    // Na fase de captura: um clique numa opção de outro seletor fecha este
    // antes de o outro abrir, e não depois.
    document.addEventListener("pointerdown", aoApontar, true);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoApontar, true);
    };
  }, [aberta, aoFechar, ancoraRef]);

  if (!aberta) return null;

  return createPortal(
    <div
      ref={caixaRef}
      className={`${styles.caixa} ${pos ? styles.posicionada : ""}`}
      style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxAltura } : undefined}
      role="dialog"
      aria-label={titulo}
    >
      {children}
    </div>,
    document.body,
  );
}
