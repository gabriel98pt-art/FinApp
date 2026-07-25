import { ChevronLeft, ChevronRight } from "lucide-react";
import { rotuloDaSemana, type Semana } from "../utils/semanas";
import styles from "../components/SeletorMes.module.css";

/** Navegação entre as semanas do mês exibido (item 10) — mesmo padrão visual
 *  do SeletorMes, reaproveitando o seu módulo de estilos. */
export default function SeletorSemana({
  semanas,
  indice,
  aoMudar,
}: {
  semanas: Semana[];
  indice: number;
  aoMudar: (i: number) => void;
}) {
  const semana = semanas[indice];
  if (!semana) return null;

  return (
    <div className={styles.seletor}>
      <button
        className={styles.seta}
        onClick={() => aoMudar(indice - 1)}
        disabled={indice <= 0}
        aria-label="Semana anterior"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className={styles.rotulo}>{rotuloDaSemana(semana)}</span>
      <button
        className={styles.seta}
        onClick={() => aoMudar(indice + 1)}
        disabled={indice >= semanas.length - 1}
        aria-label="Próxima semana"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
