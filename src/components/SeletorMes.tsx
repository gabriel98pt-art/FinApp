import { ChevronLeft, ChevronRight } from "lucide-react";
import type { YearMonth } from "../types";
import { rotuloMes, somarMeses } from "../utils/calculos";
import styles from "./SeletorMes.module.css";

export default function SeletorMes({
  mes,
  aoMudar,
}: {
  mes: YearMonth;
  aoMudar: (novo: YearMonth) => void;
}) {
  return (
    <div className={styles.seletor}>
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
