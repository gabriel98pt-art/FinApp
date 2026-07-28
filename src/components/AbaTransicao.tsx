import type { ReactNode } from "react";
import styles from "./AbaTransicao.module.css";

/** Entrada do conteúdo ao trocar de aba dentro da página. Mais discreta que a
 *  transição entre páginas (só fade, e no --dur-fast): trocar de aba é gesto
 *  frequente, não pode chamar atenção nem atrasar a resposta ao toque.
 *
 *  A `key` pela aba é o que remonta o nó e dispara a animação de novo. */
export default function AbaTransicao({ aba, children }: { aba: string; children: ReactNode }) {
  return (
    <div key={aba} className={styles.entrada}>
      {children}
    </div>
  );
}
