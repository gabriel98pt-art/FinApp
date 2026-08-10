// Funções puras do Calendário (seção 3) — usadas pela tela e pelo intent de
// calendário do Copiloto (mesma janela de "próximos 7 dias").

import type { EventoCalendario, IsoDate, YearMonth } from "../types";
import { mesDe, somarDias } from "./calculos";

/** Rótulos das colunas do grid — domingo primeiro, como `Date#getDay()`. Serve
 *  de referência fixa para `rotulosDiasSemana` girar. */
export const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** As colunas do grid, começando no dia escolhido em Definições (0=domingo…
 *  6=sábado) — mesmo `DIAS_SEMANA` girado, pra bater com `diasDoGrid`. */
export function rotulosDiasSemana(inicioSemana: number): string[] {
  return [...DIAS_SEMANA.slice(inicioSemana), ...DIAS_SEMANA.slice(0, inicioSemana)];
}

function isoDeDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Células do grid mensal: os dias do mês mais o preenchimento das semanas
 *  incompletas nas pontas. Usado pela tela do Calendário e pelo calendário do
 *  `SeletorData` — o mesmo desenho nos dois lugares — e por `semanasDoMes`
 *  (utils/semanas.ts), que fatia estas células em blocos de 7.
 *
 *  `inicioSemana` (0=domingo…6=sábado) é o dia escolhido em Definições
 *  (`cfg.diaInicioSemana`) — sem valor padrão de propósito: cada chamador tem
 *  de vir da configuração de verdade, nunca de um domingo cravado, senão a
 *  mesma inconsistência que motivou isto (Veículo começando diferente do
 *  resto) volta a acontecer num sítio esquecido. */
export function diasDoGrid(
  ym: YearMonth,
  inicioSemana: number,
): { data: IsoDate; foraDoMes: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const diaDaSemana1 = new Date(y, m - 1, 1).getDay(); // 0=domingo
  const offset = (diaDaSemana1 - inicioSemana + 7) % 7;
  const ultimoDiaMes = new Date(y, m, 0).getDate();

  const celulas: { data: IsoDate; foraDoMes: boolean }[] = [];
  // dias do mês anterior pra preencher a primeira semana
  for (let i = offset; i > 0; i--) {
    celulas.push({ data: isoDeDate(new Date(y, m - 1, 1 - i)), foraDoMes: true });
  }
  for (let dia = 1; dia <= ultimoDiaMes; dia++) {
    celulas.push({ data: `${ym}-${String(dia).padStart(2, "0")}`, foraDoMes: false });
  }
  // dias do mês seguinte pra fechar a última semana
  let extra = 1;
  while (celulas.length % 7 !== 0) {
    celulas.push({ data: isoDeDate(new Date(y, m, extra++)), foraDoMes: true });
  }
  return celulas;
}

export function eventosDoDia(eventos: EventoCalendario[], dia: IsoDate): EventoCalendario[] {
  return eventos.filter((e) => e.data === dia);
}

export function eventosDoMes(eventos: EventoCalendario[], ym: YearMonth): EventoCalendario[] {
  return eventos.filter((e) => mesDe(e.data) === ym);
}

/** Dias (dentro do mês) que têm pelo menos um evento — pro indicador visual
 *  do grid. */
export function diasComEventoNoMes(eventos: EventoCalendario[], ym: YearMonth): Set<string> {
  return new Set(eventosDoMes(eventos, ym).map((e) => e.data));
}

/** Eventos futuros dentro da janela de N dias (padrão 7) — mesma janela usada
 *  pelo Copiloto. */
export function proximosEventos(
  eventos: EventoCalendario[],
  hoje: IsoDate,
  dias = 7,
): EventoCalendario[] {
  const limite = somarDias(hoje, dias);
  return eventos
    .filter((e) => e.data >= hoje && e.data <= limite)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}
