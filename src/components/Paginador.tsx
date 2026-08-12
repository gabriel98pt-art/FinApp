import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Paginador.module.css";

/** Setas ‹ › + "N / M" — visual compartilhado por ListaLancamentos e Kpis.
 *  Não renderiza nada com 1 página só (nada pra navegar). */
export default function Paginador({
  pagina,
  paginas,
  aoMudar,
}: {
  pagina: number;
  paginas: number;
  aoMudar: (pagina: number) => void;
}) {
  if (paginas <= 1) return null;

  return (
    <div className={styles.pager}>
      <button
        onClick={() => aoMudar(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft size={16} aria-hidden />
      </button>
      {/* A lista inteira troca de conteúdo ao mudar de página, mas o foco fica
          na seta — sem região viva, nada é anunciado e a pessoa não sabe se o
          toque pegou. Anunciar o contador (curto) em vez da lista (15 linhas)
          dá a confirmação sem despejar tudo outra vez. */}
      <span aria-live="polite">
        {pagina} / {paginas}
      </span>
      <button
        onClick={() => aoMudar(pagina + 1)}
        disabled={pagina >= paginas}
        aria-label="Página seguinte"
      >
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );
}
