import type { ReactNode } from "react";
import styles from "./BottomSheet.module.css";

/** Bottom sheet genérica. Transição simples de opacidade+slide por enquanto —
 *  a física de mola do drag-to-close (seção 6) chega numa passada dedicada.
 *  Nunca display:none: abre/fecha por opacidade + pointer-events. */
export default function BottomSheet({
  aberta,
  aoFechar,
  titulo,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <>
      <div
        className={`${styles.veu} ${aberta ? styles.veuVisivel : ""}`}
        onClick={aoFechar}
        aria-hidden
      />
      <div
        className={`${styles.folha} material ${aberta ? styles.aberta : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!aberta}
      >
        <div className={styles.pegador} aria-hidden />
        <h2 className={styles.titulo}>{titulo}</h2>
        {children}
      </div>
    </>
  );
}
