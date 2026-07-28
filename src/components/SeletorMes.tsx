import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BottomSheet from "./BottomSheet";
import type { YearMonth } from "../types";
import {
  anoDe,
  MESES_CURTOS_PT,
  mesAtual,
  mesDoAno,
  rotuloMes,
  somarMeses,
} from "../utils/calculos";
import styles from "./SeletorMes.module.css";

export default function SeletorMes({
  mes,
  aoMudar,
  compacto = false,
  nivel = 0,
}: {
  mes: YearMonth;
  aoMudar: (novo: YearMonth) => void;
  /** Versão estreita, para o header fixo (item 1): num telemóvel o rótulo
   *  largo do padrão empurraria o logo pra fora. */
  compacto?: boolean;
  /** O seletor vive no header, não dentro de outra folha — daí o 0. */
  nivel?: number;
}) {
  const [aberta, setAberta] = useState(false);
  const [ano, setAno] = useState(() => anoDe(mes));
  const hoje = mesAtual();

  /** Abrir mostra sempre o ano do mês exibido, mesmo depois de ter navegado
   *  por outros anos e fechado sem escolher. */
  function abrir() {
    setAno(anoDe(mes));
    setAberta(true);
  }

  function escolher(ym: YearMonth) {
    aoMudar(ym);
    setAberta(false);
  }

  return (
    <div className={`${styles.seletor} ${compacto ? styles.compacto : ""}`}>
      <button
        className={styles.seta}
        onClick={() => aoMudar(somarMeses(mes, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      {/* Tocar no rótulo salta direto para qualquer mês — voltar um ano pela
          seta eram 12 toques. */}
      <button
        type="button"
        className={`${styles.rotulo} ${styles.gatilho}`}
        onClick={abrir}
        aria-label={`Mês exibido: ${rotuloMes(mes)}. Tocar para escolher outro.`}
      >
        {rotuloMes(mes)}
      </button>
      <button
        className={styles.seta}
        onClick={() => aoMudar(somarMeses(mes, 1))}
        aria-label="Mês seguinte"
      >
        <ChevronRight size={18} aria-hidden />
      </button>

      <BottomSheet
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Escolher mês"
        nivel={nivel}
      >
        <div className={styles.navAno}>
          <button
            type="button"
            className={styles.seta}
            onClick={() => setAno(ano - 1)}
            aria-label="Ano anterior"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className={styles.ano}>{ano}</span>
          <button
            type="button"
            className={styles.seta}
            onClick={() => setAno(ano + 1)}
            aria-label="Ano seguinte"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.grade}>
          {MESES_CURTOS_PT.map((nome, i) => {
            const ym = mesDoAno(ano, i + 1);
            return (
              <button
                key={ym}
                type="button"
                className={[
                  styles.mesBotao,
                  ym === mes ? styles.mesEscolhido : "",
                  ym === hoje ? styles.mesHoje : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={ym === mes ? "true" : undefined}
                onClick={() => escolher(ym)}
              >
                {nome}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
