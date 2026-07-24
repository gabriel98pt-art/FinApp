import { useRef, type ReactNode } from "react";
import { useDragToClose } from "../hooks/useDragToClose";
import styles from "./BottomSheet.module.css";

/** Bottom sheet genérica. Transição simples de opacidade+slide por padrão.
 *  `arrastavel` liga o drag-to-close com física de mola real (seção 6) —
 *  hoje só o Registro Rápido usa; modais/toast/menu "Mais" continuam com a
 *  transição CSS simples. Nunca display:none: abre/fecha por opacidade +
 *  pointer-events. */
export default function BottomSheet({
  aberta,
  aoFechar,
  titulo,
  children,
  arrastavel = false,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  arrastavel?: boolean;
}) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const arrasto = useDragToClose({ folhaRef, veuRef, aoFechar });

  return (
    <>
      <div
        ref={veuRef}
        className={`${styles.veu} ${aberta ? styles.veuVisivel : ""}`}
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={folhaRef}
        className={`${styles.folha} ${aberta ? styles.aberta : ""}`}
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
    </>
  );
}
