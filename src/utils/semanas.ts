// Semanas de um mês (item 10) — a visão "Mês / Semana" de Despesas correntes
// e de Veículo → Carregamentos.
//
// As semanas são exatamente as linhas do grid do Calendário (`diasDoGrid`):
// blocos de 7 dias começando no dia escolhido em Definições
// (`cfg.diaInicioSemana`), cobrindo o mês inteiro. Assim a semana que o
// usuário vê aqui é a mesma que ele vê no Calendário — e as pontas podem cair
// no mês vizinho, que é o que "7 dias" significa.

import type { IsoDate, YearMonth } from "../types";
import { diasDoGrid } from "./calendario";

export interface Semana {
  inicio: IsoDate;
  fim: IsoDate;
}

/** `inicioSemana` (0=domingo…6=sábado) vem de `cfg.diaInicioSemana` — sem
 *  padrão de propósito, ver `diasDoGrid`. */
export function semanasDoMes(ym: YearMonth, inicioSemana: number): Semana[] {
  const celulas = diasDoGrid(ym, inicioSemana);
  const semanas: Semana[] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push({ inicio: celulas[i].data, fim: celulas[i + 6].data });
  }
  return semanas;
}

/** Índice da semana que contém `dia` — serve pra abrir a visão já na semana
 *  de hoje quando faz sentido. Quando `dia` está fora do mês, cai na ponta
 *  mais perto dele: a ÚLTIMA semana se `dia` já passou do mês (o caso comum —
 *  header ainda num mês antigo, "abrir a semana atual" quer dizer a mais
 *  recente dali), a PRIMEIRA se `dia` ainda não chegou lá (mês no futuro). */
export function indiceDaSemana(semanas: Semana[], dia: IsoDate): number {
  const i = semanas.findIndex((s) => dia >= s.inicio && dia <= s.fim);
  if (i !== -1) return i;
  const ultima = semanas[semanas.length - 1];
  return ultima && dia > ultima.fim ? semanas.length - 1 : 0;
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
