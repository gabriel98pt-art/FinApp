import type { ReactNode } from "react";
import { idAba, idPainelAba } from "../utils/abas";
import styles from "./AbaTransicao.module.css";

/** Entrada do conteúdo ao trocar de aba dentro da página. Mais discreta que a
 *  transição entre páginas (só fade, e no --dur-fast): trocar de aba é gesto
 *  frequente, não pode chamar atenção nem atrasar a resposta ao toque.
 *
 *  A `key` pela aba é o que remonta o nó e dispara a animação de novo.
 *
 *  É também o `tabpanel` do padrão ARIA de abas. As três páginas com abas
 *  (Despesas, Veículo, TVDE) declaravam `role="tablist"` e `role="tab"` mas
 *  nunca o painel: metade do padrão. Sem ele, um leitor de ecrã anuncia
 *  "separador, seleccionado" e não tem região nenhuma associada — não há como
 *  saltar do separador para o conteúdo que ele comanda, que é justamente o que
 *  a navegação por abas serve para fazer. */
export default function AbaTransicao({ aba, children }: { aba: string; children: ReactNode }) {
  return (
    <div
      key={aba}
      className={styles.entrada}
      role="tabpanel"
      id={idPainelAba(aba)}
      aria-labelledby={idAba(aba)}
    >
      {children}
    </div>
  );
}
