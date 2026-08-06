// Despesas fixas gerais (aluguel, assinaturas, seguro etc.) — mesmo padrão
// das fixas do veículo (utils/veiculo.ts), domínio próprio e independente.

import type { Cents, DespesaFixa, YearMonth } from "../types";
import { fixaAtivaNoMes, fixaEfetivamentePaga, mesesPagosComoAutoDebit } from "./fatura";

/** Contribuição das despesas fixas gerais no mês. Mesma regra do veículo
 *  (contribuicaoFixasVeiculoMes, seção "Parte A"):
 *  - mês CORRENTE (ym === mesReal): só conta as marcadas pagas naquele mês;
 *  - qualquer outro mês (passado ou futuro): conta o valor cheio de todas as
 *    ativas. */
export function contribuicaoFixasMes(
  fixas: DespesaFixa[],
  ym: YearMonth,
  mesReal: YearMonth,
): Cents {
  const ativas = fixas.filter((f) => fixaAtivaNoMes(f, ym));
  if (ym === mesReal) {
    return ativas
      .filter((f) => fixaEfetivamentePaga(f, ym, mesReal))
      .reduce((s, f) => s + f.valor, 0);
  }
  return ativas.reduce((s, f) => s + f.valor, 0);
}

/** Total acumulado de todos os tempos: cada fixa conta o valor × quantos meses
 *  já saíram — mesma filosofia de totalVeiculoGeral.
 *
 *  "Já saíram" são os meses marcados à mão MAIS, com `mesReferencia`, os meses
 *  em que a fixa saiu sozinha do cartão (ver `mesesPagosComoAutoDebit`), sem
 *  contar duas vezes um mês que esteja nos dois. Sem `mesReferencia` conta só o
 *  marcado, como sempre contou. */
export function totalFixasGeral(fixas: DespesaFixa[], mesReferencia?: YearMonth): Cents {
  return fixas.reduce((s, f) => {
    const marcados = Object.entries(f.pagoPorMes ?? {})
      .filter(([, pago]) => pago)
      .map(([mes]) => mes as YearMonth);
    const automaticos = mesReferencia ? mesesPagosComoAutoDebit(f, mesReferencia) : [];
    return s + f.valor * new Set([...marcados, ...automaticos]).size;
  }, 0);
}
