// Funções puras de parcelas (seção 4.3) — comportamento portado do app de
// referência, sem dependência de Firebase/DOM.

import type { Cents, YearMonth } from "../types";
import type { Parcela } from "../types";
import { somarMeses } from "./calculos";

/** Todos os meses do plano, do primeiro ao último. */
export function mesesDaParcela(p: Parcela): YearMonth[] {
  const meses: YearMonth[] = [];
  for (let i = 0; i < p.numParcelas; i++) meses.push(somarMeses(p.primeiroMes, i));
  return meses;
}

/** Valor-base da parcela de índice `idx` (0-based): divisão exata do total em
 *  centavos — o resto vai às primeiras parcelas (55,99 em 3× → 18,67 + 18,66
 *  + 18,66), igual ao app de referência. */
export function valorBaseDaParcela(p: Parcela, idx: number): Cents {
  const n = p.numParcelas || 1;
  const base = Math.floor(p.total / n);
  const resto = p.total - base * n;
  return base + (idx < resto ? 1 : 0);
}

/** Valor da parcela num mês: ajuste manual daquele mês, se existir; senão a
 *  divisão exata. Mês fora do plano vale 0. */
export function valorDaParcela(p: Parcela, ym: YearMonth): Cents {
  const override = p.overridePorMes?.[ym];
  if (override != null) return override;
  const idx = mesesDaParcela(p).indexOf(ym);
  if (idx < 0) return 0;
  return valorBaseDaParcela(p, idx);
}

export function mesesNaoPagos(p: Parcela): YearMonth[] {
  return mesesDaParcela(p).filter((m) => !p.pagoPorMes[m]);
}

/** Soma das parcelas em aberto — o valor de uma quitação antecipada. */
export function valorQuitacao(p: Parcela): Cents {
  return mesesNaoPagos(p).reduce((s, m) => s + valorDaParcela(p, m), 0);
}

export function progressoDaParcela(p: Parcela): { pagas: number; total: number } {
  const meses = mesesDaParcela(p);
  return { pagas: meses.filter((m) => p.pagoPorMes[m]).length, total: meses.length };
}

export function parcelaQuitada(p: Parcela): boolean {
  return mesesNaoPagos(p).length === 0;
}
