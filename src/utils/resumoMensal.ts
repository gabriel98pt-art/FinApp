// "Despesa realizada do mês" combinando despesas correntes + veículo — fonte
// única usada em Início, Despesas, Metas, Resumo Anual e Copiloto, pra nunca
// divergir entre telas (seção 3 / 4.8).

import type { Cents, DadosVeiculo, DespesaCorrente, Receita, YearMonth } from "../types";
import { despesasNosTotais, totalDoMes } from "./calculos";
import { totalVeiculoMes } from "./veiculo";

export interface ResumoMesCompleto {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Despesa do mês = despesas correntes reais (sem pagamento de fatura) +
 *  total do veículo (cargas + despesas + fixas — seção "Parte A"). */
export function despesaRealizadaMes(
  despesasCorrentes: DespesaCorrente[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
): Cents {
  return (
    totalDoMes(despesasNosTotais(despesasCorrentes), ym) + totalVeiculoMes(veiculo, ym, mesReal)
  );
}

export function resumoMesCompleto(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
): ResumoMesCompleto {
  const r = totalDoMes(receitas, ym);
  const d = despesaRealizadaMes(despesasCorrentes, veiculo, ym, mesReal);
  return { receitas: r, despesas: d, saldo: r - d };
}
