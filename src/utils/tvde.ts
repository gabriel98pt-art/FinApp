// Módulo TVDE (seção 4.4) — funções puras portadas do financas.html
// (linhas ~10200-10470). As fórmulas vêm de uma planilha real do dono do
// produto e NÃO podem mudar de comportamento — portar tal como está; se algo
// parecer "melhorável", deixar comentário, não mudar.
//
// Moeda: SEMPRE EUR neste módulo, independente da conta (decisão deliberada
// do app de origem) — valores em centavos; derivados podem ter fração de
// centavo (o app antigo calculava em float) e só arredondam na exibição.

import type { Cents, IsoDate, SemanaTvde, YearMonth } from "../types";

/* ---------- datas de semana ---------- */

function paraData(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function paraIso(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function inicioDaSemana(inicioSemana1: IsoDate, n: number): Date {
  const d = paraData(inicioSemana1);
  d.setDate(d.getDate() + (n - 1) * 7);
  return d;
}

export function fimDaSemana(inicioSemana1: IsoDate, n: number): Date {
  const d = inicioDaSemana(inicioSemana1, n);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Dia em que o valor da semana é efetivamente recebido — um dia depois do
 *  fim (a segunda-feira seguinte). */
export function dataPagamentoDaSemana(inicioSemana1: IsoDate, n: number): IsoDate {
  const d = fimDaSemana(inicioSemana1, n);
  d.setDate(d.getDate() + 1);
  return paraIso(d);
}

/** MÊS DE PAGAMENTO da semana: o mês onde cai início+7 dias — sempre o mês
 *  seguinte quando a semana termina na virada (regra do app de origem). */
export function mesDePagamento(inicioSemana1: IsoDate, n: number): YearMonth {
  const d = inicioDaSemana(inicioSemana1, n);
  d.setDate(d.getDate() + 7);
  return paraIso(d).slice(0, 7);
}

function dd(n: number): string {
  return String(n).padStart(2, "0");
}

function ddm(d: Date): string {
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
}

/** "02/03 – 08/03" */
export function rotuloDaSemana(inicioSemana1: IsoDate, n: number): string {
  return `${ddm(inicioDaSemana(inicioSemana1, n))} – ${ddm(fimDaSemana(inicioSemana1, n))}`;
}

export function periodoDaSemana(n: number): number {
  return Math.ceil(n / 4);
}

export function rotuloDoPeriodo(inicioSemana1: IsoDate, p: number): string {
  return `${ddm(inicioDaSemana(inicioSemana1, p * 4 - 3))} – ${ddm(fimDaSemana(inicioSemana1, p * 4))}`;
}

/** Semana em que cai o dia de hoje. Math.round nos dias absorve a mudança de
 *  hora (DST), igual ao app de origem. */
export function semanaDeHoje(inicioSemana1: IsoDate, hoje = new Date()): number {
  const inicio = paraData(inicioSemana1);
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((dia.getTime() - inicio.getTime()) / (24 * 3600 * 1000));
  return Math.floor(dias / 7) + 1;
}

/* ---------- fórmula central (da planilha — NÃO mudar) ---------- */

export interface CalculoSemana {
  frota: number;
  receita: number;
  lucro: number;
  custos: number;
  /** Centavos por hora, ou null sem horas. */
  ganhosPorHora: number | null;
  /** Centavos por viagem, ou null sem viagens. */
  eurPorViagem: number | null;
  /** Fração (0-1), ou null sem faturamento. */
  pctCusto: number | null;
}

export function calcularSemana(w: SemanaTvde, pctFrotaPadrao: number): CalculoSemana {
  const pct = ((w.pct ?? pctFrotaPadrao) || 0) / 100;
  const frota = (w.fat || 0) * pct;
  const receita = (w.fat || 0) - frota - (w.port || 0) - (w.alu || 0) - (w.recF || 0);
  const lucro = receita - (w.recP || 0) + (w.extra || 0); // gorjetas NUNCA somam
  const custos = frota + (w.port || 0) + (w.alu || 0) + (w.recF || 0) + (w.recP || 0);
  return {
    frota,
    receita,
    lucro,
    custos,
    ganhosPorHora: w.horas > 0 ? lucro / w.horas : null,
    eurPorViagem: w.viag > 0 ? lucro / w.viag : null,
    pctCusto: w.fat > 0 ? custos / w.fat : null,
  };
}

/* ---------- agregados ---------- */

export function numerosDasSemanas(semanas: Record<string, SemanaTvde>): number[] {
  return Object.keys(semanas)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export interface TotaisPerformance {
  fat: number;
  receita: number;
  lucro: number;
  custos: number;
  horas: number;
  viag: number;
  recP: number;
  gorj: number;
  n: number;
  /** Seg. Social descontada (só de meses de pagamento com semana fat>0). */
  segTotal: number;
  lucroLiquido: number;
  mediaSemana: number;
  /** Média de lucro/hora das semanas com horas (lucro somado / horas somadas). */
  mediaPorHora: number;
  melhor: { n: number; lucro: number } | null;
  pior: { n: number; lucro: number } | null;
  /** Média das últimas 4 semanas vs as 4 anteriores. */
  media4: number;
  prev4: number | null;
}

/** Agregado de PERFORMANCE: ignora COMPLETAMENTE semanas de teste (nem soma,
 *  nem contagem). Dinheiro real fica nos agregados por mês/período abaixo. */
export function totaisPerformance(
  semanas: Record<string, SemanaTvde>,
  segPorMes: Record<YearMonth, Cents>,
  inicioSemana1: IsoDate,
  pctFrotaPadrao: number,
): TotaisPerformance {
  const t: TotaisPerformance = {
    fat: 0,
    receita: 0,
    lucro: 0,
    custos: 0,
    horas: 0,
    viag: 0,
    recP: 0,
    gorj: 0,
    n: 0,
    segTotal: 0,
    lucroLiquido: 0,
    mediaSemana: 0,
    mediaPorHora: 0,
    melhor: null,
    pior: null,
    media4: 0,
    prev4: null,
  };
  const comLucro: { n: number; lucro: number; horas: number }[] = [];

  for (const n of numerosDasSemanas(semanas)) {
    const w = semanas[String(n)];
    if (!(w.fat > 0) || w.teste) continue;
    const c = calcularSemana(w, pctFrotaPadrao);
    t.fat += w.fat;
    t.receita += c.receita;
    t.lucro += c.lucro;
    t.custos += c.custos;
    t.horas += w.horas || 0;
    t.viag += w.viag || 0;
    t.recP += w.recP || 0;
    t.gorj += w.gorj || 0;
    t.n++;
    comLucro.push({ n, lucro: c.lucro, horas: w.horas || 0 });
  }

  // Só desconta Seg. Social de meses de pagamento que têm alguma semana com
  // faturamento — semanas de TESTE também validam o mês (igual à origem:
  // dinheiro real conta, só a performance é filtrada).
  const mesesValidos = new Set<YearMonth>();
  for (const n of numerosDasSemanas(semanas)) {
    if (semanas[String(n)].fat > 0) mesesValidos.add(mesDePagamento(inicioSemana1, n));
  }
  for (const [m, v] of Object.entries(segPorMes)) {
    if (mesesValidos.has(m)) t.segTotal += v || 0;
  }
  t.lucroLiquido = t.lucro - t.segTotal;

  t.mediaSemana = t.n ? comLucro.reduce((a, x) => a + x.lucro, 0) / t.n : 0;
  const comHoras = comLucro.filter((x) => x.horas > 0);
  const horasSoma = comHoras.reduce((a, x) => a + x.horas, 0);
  t.mediaPorHora = horasSoma > 0 ? comHoras.reduce((a, x) => a + x.lucro, 0) / horasSoma : 0;

  for (const x of comLucro) {
    if (t.melhor === null || x.lucro > t.melhor.lucro) t.melhor = { n: x.n, lucro: x.lucro };
    if (t.pior === null || x.lucro < t.pior.lucro) t.pior = { n: x.n, lucro: x.lucro };
  }

  const ultimas4 = comLucro.slice(-4);
  const anteriores4 = comLucro.slice(-8, -4);
  t.media4 = ultimas4.length ? ultimas4.reduce((a, x) => a + x.lucro, 0) / ultimas4.length : 0;
  t.prev4 = anteriores4.length
    ? anteriores4.reduce((a, x) => a + x.lucro, 0) / anteriores4.length
    : null;

  return t;
}

export interface MesTvde {
  mes: YearMonth;
  lucro: number;
  receita: number;
  recP: number;
  seg: Cents;
  liquido: number;
}

/** Visão por mês de pagamento — DINHEIRO REAL: semanas de teste CONTAM. */
export function dadosPorMes(
  semanas: Record<string, SemanaTvde>,
  segPorMes: Record<YearMonth, Cents>,
  inicioSemana1: IsoDate,
  pctFrotaPadrao: number,
): MesTvde[] {
  const mapa = new Map<YearMonth, MesTvde>();
  for (const n of numerosDasSemanas(semanas)) {
    const w = semanas[String(n)];
    if (!(w.fat > 0)) continue;
    const m = mesDePagamento(inicioSemana1, n);
    const c = calcularSemana(w, pctFrotaPadrao);
    const item = mapa.get(m) ?? { mes: m, lucro: 0, receita: 0, recP: 0, seg: 0, liquido: 0 };
    item.lucro += c.lucro;
    item.receita += c.receita;
    item.recP += w.recP || 0;
    mapa.set(m, item);
  }
  return [...mapa.values()].map((item) => {
    item.seg = segPorMes[item.mes] || 0;
    item.liquido = item.lucro - item.seg;
    return item;
  });
}

export interface PeriodoTvde {
  periodo: number;
  fat: number;
  receita: number;
  recP: number;
  lucro: number;
  horas: number;
  viag: number;
}

/** Visão por período de 4 semanas — DINHEIRO REAL: semanas de teste CONTAM. */
export function dadosPorPeriodo(
  semanas: Record<string, SemanaTvde>,
  pctFrotaPadrao: number,
): PeriodoTvde[] {
  const mapa = new Map<number, PeriodoTvde>();
  for (const n of numerosDasSemanas(semanas)) {
    const w = semanas[String(n)];
    if (!(w.fat > 0)) continue;
    const p = periodoDaSemana(n);
    const c = calcularSemana(w, pctFrotaPadrao);
    const item = mapa.get(p) ?? {
      periodo: p,
      fat: 0,
      receita: 0,
      recP: 0,
      lucro: 0,
      horas: 0,
      viag: 0,
    };
    item.fat += w.fat;
    item.receita += c.receita;
    item.recP += w.recP || 0;
    item.lucro += c.lucro;
    item.horas += w.horas || 0;
    item.viag += w.viag || 0;
    mapa.set(p, item);
  }
  return [...mapa.values()].sort((a, b) => a.periodo - b.periodo);
}
