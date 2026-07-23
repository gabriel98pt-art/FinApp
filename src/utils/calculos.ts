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

/** Ordena por data decrescente (mais recente primeiro), estável. */
export function ordenarPorDataDesc<T extends ItemComValor>(itens: T[]): T[] {
  return [...itens].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
