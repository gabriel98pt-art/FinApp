// Funções puras de agregação — sempre em centavos inteiros (seção 4.2),
// sem dependência de Firebase/DOM. Comportamento portado do js/calc.js antigo.

import type { Cents, IsoDate, YearMonth } from "../types";

export interface ItemComValor {
  valor: Cents;
  data: IsoDate;
}

/** 'YYYY-MM-DD' → 'YYYY-MM' por corte de string — evita Date/timezone. */
export function mesDe(data: IsoDate): YearMonth {
  return data.slice(0, 7);
}

export function total(itens: ItemComValor[]): Cents {
  return itens.reduce((acc, i) => acc + i.valor, 0);
}

export function doMes<T extends ItemComValor>(itens: T[], anoMes: YearMonth): T[] {
  return itens.filter((i) => mesDe(i.data) === anoMes);
}

export function totalDoMes(itens: ItemComValor[], anoMes: YearMonth): Cents {
  return total(doMes(itens, anoMes));
}

export interface ResumoMes {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Resumo de um mês: receitas, despesas e saldo (receitas − despesas). */
export function resumoMes(
  receitas: ItemComValor[],
  despesas: ItemComValor[],
  anoMes: YearMonth,
): ResumoMes {
  const r = totalDoMes(receitas, anoMes);
  const d = totalDoMes(despesas, anoMes);
  return { receitas: r, despesas: d, saldo: r - d };
}

/** Saldo acumulado de todos os lançamentos. */
export function saldoTotal(receitas: ItemComValor[], despesas: ItemComValor[]): Cents {
  return total(receitas) - total(despesas);
}

/** Data de hoje no fuso local, como 'YYYY-MM-DD'. */
export function hojeIso(): IsoDate {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function mesAtual(): YearMonth {
  return mesDe(hojeIso());
}

/** Soma n meses a um 'YYYY-MM' (n pode ser negativo). */
export function somarMeses(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Últimos n meses terminando em `ate` (incluído), em ordem crescente.
 *  Portado de getLast(n, from). */
export function mesesRecentes(n: number, ate: YearMonth): YearMonth[] {
  const meses: YearMonth[] = [];
  for (let i = n - 1; i >= 0; i--) meses.push(somarMeses(ate, -i));
  return meses;
}

/** Soma n dias a uma data 'YYYY-MM-DD' (n pode ser negativo). Usa meio-dia
 *  UTC pra não escorregar de dia por causa de DST. */
export function somarDias(data: IsoDate, n: number): IsoDate {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const MESES_PT = [
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

/** '2026-07' → 'julho 2026'. */
export function rotuloMes(ym: YearMonth): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_PT[(m ?? 1) - 1]} ${y}`;
}

/** Filtra os lançamentos que CONTAM como despesa nos KPIs/resumos.
 *  Pagamentos de fatura (origem 'fat') ficam de fora: a compra no cartão já
 *  contou como despesa no mês dela — contar também o pagamento seria contar
 *  duas vezes (bug conhecido do app antigo, seção 4.1, a não reproduzir).
 *  O destino claro deles é a tela Cartões (total pago da fatura). */
export function despesasNosTotais<T extends { origem?: string }>(itens: T[]): T[] {
  return itens.filter((d) => d.origem !== "fat");
}

/** Ordena por data decrescente (mais recente primeiro), estável. */
export function ordenarPorDataDesc<T extends ItemComValor>(itens: T[]): T[] {
  return [...itens].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
