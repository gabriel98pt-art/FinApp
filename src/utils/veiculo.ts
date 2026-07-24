// Totais do veículo (seção 3, Parte A) — funções puras em centavos.
// Portado do financas.html: totVeh(ym) = cargas + despesas variáveis + fixas
// ativas do veículo, somado dentro do total geral de despesas do app.

import type { Cents, DadosVeiculo, YearMonth } from "../types";
import { doMes, mesDe, totalDoMes } from "./calculos";
import { fixaAtivaNoMes } from "./fatura";

export function totalCargasMes(veiculo: DadosVeiculo, ym: YearMonth): Cents {
  return veiculo.cargas.filter((c) => mesDe(c.data) === ym).reduce((s, c) => s + c.custo, 0);
}

export function totalDespesasVeiculoMes(veiculo: DadosVeiculo, ym: YearMonth): Cents {
  return totalDoMes(veiculo.despesas, ym);
}

/** Contribuição das despesas fixas do veículo no mês. Mesma regra do app de
 *  referência (renderMetas/totDespRealized), aplicada só a este domínio —
 *  despesas correntes e parcelas do FinApp já só entram nos totais quando
 *  realmente pagas (estabelecido no Marco 3), então não têm o problema de
 *  "obrigação ainda não paga inflando o mês corrente" que a fixa tem:
 *  - mês CORRENTE (ym === mesReal): só conta as marcadas pagas naquele mês;
 *  - qualquer outro mês (passado ou futuro): conta o valor cheio de todas as
 *    ativas, igual ao "totDesp" do app de referência pra meses fechados. */
export function contribuicaoFixasVeiculoMes(
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
): Cents {
  const ativas = veiculo.despesasFixas.filter((f) => fixaAtivaNoMes(f, ym));
  if (ym === mesReal) {
    return ativas.filter((f) => f.pagoPorMes[ym]).reduce((s, f) => s + f.valor, 0);
  }
  return ativas.reduce((s, f) => s + f.valor, 0);
}

/** Total do veículo no mês — cargas + despesas variáveis + fixas (seção 3). */
export function totalVeiculoMes(veiculo: DadosVeiculo, ym: YearMonth, mesReal: YearMonth): Cents {
  return (
    totalCargasMes(veiculo, ym) +
    totalDespesasVeiculoMes(veiculo, ym) +
    contribuicaoFixasVeiculoMes(veiculo, ym, mesReal)
  );
}

export function lancamentosDoMesVeiculo(veiculo: DadosVeiculo, ym: YearMonth) {
  return {
    cargas: veiculo.cargas.filter((c) => mesDe(c.data) === ym),
    despesas: doMes(veiculo.despesas, ym),
  };
}
