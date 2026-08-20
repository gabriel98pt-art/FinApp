import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { responderConfirmacao, useConfirmarStore } from "../stores/confirmarStore";
import styles from "./ConfirmarAcao.module.css";

/** Diálogo de confirmação do app. Cartão central em vez de folha: é uma
 *  pergunta curta de sim/não, não um formulário — e o cartão no meio da tela
 *  lê como interrupção, que é o que uma ação destrutiva merece.
 *
 *  Montado uma única vez no AppShell; quem pergunta usa `useConfirmar()`. */
export default function ConfirmarAcao() {
  const aberto = useConfirmarStore((s) => s.aberto);
  const mensagem = useConfirmarStore((s) => s.mensagem);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  /** Quem tinha o foco antes do diálogo abrir, para lho devolver no fecho. */
  const anterior = useRef<HTMLElement | null>(null);

  // Esc cancela, como no diálogo do sistema. O foco vai para o botão de
  // confirmar ao abrir, senão fica preso na tela por trás.
  useEffect(() => {
    if (!aberto) return;
    anterior.current = document.activeElement as HTMLElement | null;
    confirmarRef.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // `stopPropagation` e fase de CAPTURA, as duas coisas de propósito. Este
      // diálogo é pedido quase sempre de DENTRO de uma folha aberta (excluir um
      // lançamento), e a folha por baixo também escuta o Esc (`useFocoModal`,
      // que ouve em `document` na fase de bolha). Sem isto o Esc chegava lá
      // primeiro: fechava a FOLHA e deixava esta confirmação órfã por cima de
      // um formulário que já não existe — com o "Confirmar" ainda a apagar. A
      // captura corre antes de qualquer listener de bolha, portanto o pedido
      // que está mesmo por cima é o único que responde.
      e.stopPropagation();
      responderConfirmacao(false);
    };

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      // Devolve o foco a quem o tinha — o botão "Excluir" dentro da folha, por
      // exemplo. Se esse elemento já saiu do DOM (o item foi mesmo apagado),
      // não há nada a devolver e o foco fica onde o browser o pôs.
      const alvo = anterior.current;
      if (alvo?.isConnected) alvo.focus?.();
    };
  }, [aberto]);

  return createPortal(
    <>
      <div
        className={`${styles.veu} ${aberto ? styles.veuVisivel : ""}`}
        onClick={() => responderConfirmacao(false)}
        aria-hidden
      />
      <div
        className={`${styles.cartao} ${aberto ? styles.aberto : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirmar"
        // `inert` e não `aria-hidden`, pela mesma razão da BottomSheet: fechado,
        // o cartão continua montado (só invisível e sem `pointer-events`), e o
        // Tab entrava na mesma nos dois botões — em qualquer tela do app a
        // tabulação acabava num "Cancelar"/"Confirmar" que ninguém vê. Pior,
        // `aria-hidden` num contentor com focáveis é ele próprio uma violação
        // de ARIA. `inert` tira-os da navegação e da árvore de acessibilidade
        // de uma vez.
        inert={!aberto}
      >
        {/* A mensagem pode trazer \n com um aviso extra na segunda linha. */}
        <p className={styles.mensagem}>{mensagem}</p>
        <div className={styles.acoes}>
          <button
            type="button"
            className={styles.cancelar}
            onClick={() => responderConfirmacao(false)}
          >
            Cancelar
          </button>
          <button
            ref={confirmarRef}
            type="button"
            className={styles.confirmar}
            onClick={() => responderConfirmacao(true)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
