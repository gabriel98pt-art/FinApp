import { ChevronLeft, ChevronRight } from "lucide-react";
import type { YearMonth } from "../types";
import { rotuloMes, somarMeses } from "../utils/calculos";
import styles from "./SeletorMes.module.css";

export default function SeletorMes({
  mes,
  aoMudar,
  compacto = false,
}: {
  mes: YearMonth;
  aoMudar: (novo: YearMonth) => void;
  /** Versão estreita, para o header fixo (item 1): num telemóvel o rótulo
   *  largo do padrão empurraria o logo pra fora. */
  compacto?: boolean;
}) {
  return (
    <div className={`${styles.seletor} ${compacto ? styles.compacto : ""}`}>
      <button
        className={styles.seta}
        onClick={() => aoMudar(somarMeses(mes, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className={styles.rotulo}>{rotuloMes(mes)}</span>
      <button
        className={styles.seta}
        onClick={() => aoMudar(somarMeses(mes, 1))}
        aria-label="Mês seguinte"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
