import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { hojeIso, mesDe, somarDias, somarMeses } from "../utils/calculos";
import { diasDoGrid, rotulosDiasSemana } from "../utils/calendario";
import { useCfgStore } from "../stores/cfgStore";
import type { IsoDate } from "../types";
import styles from "./SeletorData.module.css";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function rotuloMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
}

function rotuloCurto(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Escolha de data no visual do app (item 16): "Hoje" e "Ontem" num toque, e
 *  "Escolher data" abrindo um calendário em grade numa folha sólida — em vez
 *  do `<input type="date">`, que abre o seletor do sistema. */
export default function SeletorData({
  valor,
  aoMudar,
  rotulo = "Data",
  nivel = 1,
}: {
  valor: IsoDate;
  aoMudar: (data: IsoDate) => void;
  rotulo?: string;
  /** O seletor quase sempre vive dentro de uma folha. */
  nivel?: number;
}) {
  const diaInicioSemana = useCfgStore((s) => s.cfg.diaInicioSemana);
  const hoje = hojeIso();
  const ontem = somarDias(hoje, -1);
  const [aberta, setAberta] = useState(false);
  const [mesGrid, setMesGrid] = useState(() => mesDe(valor || hoje));

  /** Abrir sempre mostra o mês da data já escolhida. */
  function abrir() {
    setMesGrid(mesDe(valor || hoje));
    setAberta(true);
  }

  const ehHoje = valor === hoje;
  const ehOntem = valor === ontem;

  return (
    <div className={styles.campo}>
      <span className={styles.rotulo}>{rotulo}</span>
      <div className={styles.atalhos}>
        <button
          type="button"
          className={`${styles.atalho} ${ehHoje ? styles.atalhoAtivo : ""}`}
          aria-pressed={ehHoje}
          onClick={() => aoMudar(hoje)}
        >
          Hoje
        </button>
        <button
          type="button"
          className={`${styles.atalho} ${ehOntem ? styles.atalhoAtivo : ""}`}
          aria-pressed={ehOntem}
          onClick={() => aoMudar(ontem)}
        >
          Ontem
        </button>
        <button
          type="button"
          className={`${styles.atalho} ${styles.escolher} ${!ehHoje && !ehOntem ? styles.atalhoAtivo : ""}`}
          onClick={abrir}
        >
          <CalendarDays size={15} aria-hidden />
          {ehHoje || ehOntem ? "Escolher data" : rotuloCurto(valor)}
        </button>
      </div>

      <BottomSheet
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Escolher data"
        nivel={nivel}
      >
        <div className={styles.navMes}>
          <button
            type="button"
            className={styles.seta}
            onClick={() => setMesGrid(somarMeses(mesGrid, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className={styles.mesRotulo}>{rotuloMes(mesGrid)}</span>
          <button
            type="button"
            className={styles.seta}
            onClick={() => setMesGrid(somarMeses(mesGrid, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.cabecalhoSemana}>
          {rotulosDiasSemana(diaInicioSemana).map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.diasGrid}>
          {diasDoGrid(mesGrid, diaInicioSemana).map(({ data, foraDoMes }) => (
            <button
              key={data}
              type="button"
              className={[
                styles.dia,
                foraDoMes ? styles.diaForaDoMes : "",
                data === hoje ? styles.diaHoje : "",
                data === valor ? styles.diaEscolhido : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                aoMudar(data);
                setAberta(false);
              }}
            >
              {parseInt(data.slice(8, 10), 10)}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
