// Agrupamento de uma lista já ordenada por data em blocos de um dia, para o
// cabeçalho "Sexta, 24 out" com o total do dia.

import type { IsoDate } from "../types";
import { MESES_CURTOS_PT } from "./calculos";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface GrupoDoDia<T> {
  dia: IsoDate;
  itens: T[];
}

/** Junta itens CONSECUTIVOS da mesma data. Não reordena: quem chama já
 *  ordenou (mais recentes ou mais antigas primeiro), e são essas ordens que
 *  dão os blocos de um dia. Com outra ordem (por valor) os dias andariam
 *  baralhados e cada item ficaria num bloco só seu — por isso a lista corrida
 *  não passa por aqui. */
export function agruparPorDia<T extends { data: IsoDate }>(itens: T[]): GrupoDoDia<T>[] {
  const grupos: GrupoDoDia<T>[] = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === item.data) ultimo.itens.push(item);
    else grupos.push({ dia: item.data, itens: [item] });
  }
  return grupos;
}

/** "Sexta, 24 out". O dia da semana sai da própria data, sem fuso horário. */
export function rotuloDoDia(dia: IsoDate): string {
  const [a, m, d] = dia.split("-").map(Number);
  const semana = DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
  return `${semana}, ${d} ${MESES_CURTOS_PT[m - 1]}`;
}
