// Funções puras do Calendário (seção 3) — usadas pela tela e pelo intent de
// calendário do Copiloto (mesma janela de "próximos 7 dias").

import type { EventoCalendario, IsoDate, YearMonth } from "../types";
import { mesDe, somarDias } from "./calculos";

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
