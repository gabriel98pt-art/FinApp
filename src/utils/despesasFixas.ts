// Despesas fixas gerais (aluguel, assinaturas, seguro etc.) — mesmo padrão
// das fixas do veículo (utils/veiculo.ts), domínio próprio e independente.

import type { Cents, DespesaFixa, YearMonth } from "../types";
import { fixaAtivaNoMes } from "./fatura";

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
    return ativas.filter((f) => f.pagoPorMes[ym]).reduce((s, f) => s + f.valor, 0);
  }
  return ativas.reduce((s, f) => s + f.valor, 0);
}

/** Total acumulado de todos os tempos: cada fixa conta o valor × quantos
 *  meses foram marcados pagos — mesma filosofia de totalVeiculoGeral. */
export function totalFixasGeral(fixas: DespesaFixa[]): Cents {
  return fixas.reduce((s, f) => {
    const mesesPagos = Object.values(f.pagoPorMes).filter(Boolean).length;
    return s + f.valor * mesesPagos;
  }, 0);
}
