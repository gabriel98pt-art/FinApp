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

  // Esc cancela, como no diálogo do sistema. O foco vai para o botão de
  // confirmar ao abrir, senão fica preso na tela por trás.
  useEffect(() => {
    if (!aberto) return;
    confirmarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") responderConfirmacao(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
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
        aria-hidden={!aberto}
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
