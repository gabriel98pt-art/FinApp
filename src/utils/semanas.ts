// Semanas de um mês (item 10) — a visão "Mês / Semana" de Despesas correntes
// e de Veículo → Carregamentos.
//
// As semanas são exatamente as linhas do grid do Calendário (`diasDoGrid`):
// blocos de 7 dias começando no domingo, cobrindo o mês inteiro. Assim a
// semana que o usuário vê aqui é a mesma que ele vê no Calendário — e as
// pontas podem cair no mês vizinho, que é o que "7 dias" significa.

import type { IsoDate, YearMonth } from "../types";
import { diasDoGrid } from "./calendario";

export interface Semana {
  inicio: IsoDate;
  fim: IsoDate;
}

export function semanasDoMes(ym: YearMonth): Semana[] {
  const celulas = diasDoGrid(ym);
  const semanas: Semana[] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push({ inicio: celulas[i].data, fim: celulas[i + 6].data });
  }
  return semanas;
}

/** Índice da semana que contém `dia`, ou 0 quando o dia está fora do mês —
 *  serve pra abrir a visão já na semana de hoje quando faz sentido. */
export function indiceDaSemana(semanas: Semana[], dia: IsoDate): number {
  const i = semanas.findIndex((s) => dia >= s.inicio && dia <= s.fim);
  return i === -1 ? 0 : i;
}

/** "02/07 – 08/07" */
export function rotuloDaSemana(s: Semana): string {
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${ddmm(s.inicio)} – ${ddmm(s.fim)}`;
}

/** Filtra qualquer lista com `data` pelos 7 dias da semana. */
export function naSemana<T extends { data: string }>(itens: T[], s: Semana): T[] {
  return itens.filter((i) => i.data >= s.inicio && i.data <= s.fim);
}
