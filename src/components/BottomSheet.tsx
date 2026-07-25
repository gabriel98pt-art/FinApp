import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDragToClose } from "../hooks/useDragToClose";
import styles from "./BottomSheet.module.css";

/** Bottom sheet genérica. Transição simples de opacidade+slide por padrão.
 *  `arrastavel` liga o drag-to-close com física de mola real (seção 6) —
 *  hoje só o Registro Rápido usa; modais/toast/menu "Mais" continuam com a
 *  transição CSS simples. Nunca display:none: abre/fecha por opacidade +
 *  pointer-events.
 *
 *  Renderiza num portal no `<body>`: `.folha` tem `transform`, o que ancora
 *  qualquer `position: fixed` descendente nela em vez de na janela — é o que
 *  quebraria uma folha aberta de DENTRO de outra (ex. o seletor de categoria
 *  dentro de um formulário). `nivel` empilha a folha aninhada acima da que a
 *  abriu. */
export default function BottomSheet({
  aberta,
  aoFechar,
  titulo,
  children,
  arrastavel = false,
  nivel = 0,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  arrastavel?: boolean;
  /** 0 = folha comum; 1+ = aberta de dentro de outra folha. */
  nivel?: number;
}) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const arrasto = useDragToClose({ folhaRef, veuRef, aoFechar });

  return createPortal(
    <>
      <div
        ref={veuRef}
        className={`${styles.veu} ${aberta ? styles.veuVisivel : ""}`}
        style={nivel ? { zIndex: 45 + nivel * 2 } : undefined}
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={folhaRef}
        className={`${styles.folha} ${aberta ? styles.aberta : ""}`}
        style={nivel ? { zIndex: 46 + nivel * 2 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!aberta}
      >
        {arrastavel ? (
          <div
            className={styles.zonaArrasto}
            onPointerDown={arrasto.aoPointerDown}
            onPointerMove={arrasto.aoPointerMove}
            onPointerUp={arrasto.aoPointerUp}
            onPointerCancel={arrasto.aoPointerCancel}
          >
            <div className={styles.pegador} aria-hidden />
            <h2 className={styles.titulo}>{titulo}</h2>
          </div>
        ) : (
          <>
            <div className={styles.pegador} aria-hidden />
            <h2 className={styles.titulo}>{titulo}</h2>
          </>
        )}
        {children}
      </div>
    </>,
    document.body,
  );
}
