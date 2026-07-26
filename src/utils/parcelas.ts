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

/** Contribuição das parcelas no mês. Mesma regra das despesas fixas
 *  (contribuicaoFixasMes, utils/despesasFixas.ts):
 *  - mês CORRENTE (ym === mesReal): só conta as marcadas pagas naquele mês;
 *  - qualquer outro mês (passado ou futuro): conta o valor cheio de todas as
 *    parcelas cujo plano cobre o mês, pagas ou não.
 *  É por AQUI que a parcela entra nos totais — não pelo lançamento espelho
 *  (origem 'parc'), que `despesasNosTotais` deixa de fora justamente pra não
 *  contar duas vezes. */
export function contribuicaoParcelasMes(
  parcelas: Parcela[],
  ym: YearMonth,
  mesReal: YearMonth,
): Cents {
  const noPrazo = parcelas.filter((p) => mesesDaParcela(p).includes(ym));
  if (ym === mesReal) {
    return noPrazo.filter((p) => p.pagoPorMes[ym]).reduce((s, p) => s + valorDaParcela(p, ym), 0);
  }
  return noPrazo.reduce((s, p) => s + valorDaParcela(p, ym), 0);
}

/** Total acumulado de todos os tempos: cada parcela conta os meses marcados
 *  pagos — mesma filosofia de totalFixasGeral/totalVeiculoGeral, e o mesmo
 *  valor que os lançamentos espelho somavam antes de saírem dos totais. */
export function totalParcelasGeral(parcelas: Parcela[]): Cents {
  return parcelas.reduce(
    (s, p) =>
      s +
      mesesDaParcela(p).reduce((sp, m) => (p.pagoPorMes[m] ? sp + valorDaParcela(p, m) : sp), 0),
    0,
  );
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
