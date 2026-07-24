// "Despesa realizada do mês" combinando despesas correntes + veículo — fonte
// única usada em Início, Despesas, Metas, Resumo Anual e Copiloto, pra nunca
// divergir entre telas (seção 3 / 4.8).

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  Receita,
  YearMonth,
} from "../types";
import { despesasNosTotais, totalDoMes } from "./calculos";
import { contribuicaoFixasMes } from "./despesasFixas";
import { totalVeiculoMes } from "./veiculo";

export interface ResumoMesCompleto {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Despesa do mês = despesas correntes reais (sem pagamento de fatura) +
 *  despesas fixas gerais (mês corrente conta só as pagas, mês fechado conta
 *  todas as ativas — mesma regra do veículo) + total do veículo (cargas +
 *  despesas + fixas — seção "Parte A"). */
export function despesaRealizadaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
): Cents {
  return (
    totalDoMes(despesasNosTotais(despesasCorrentes), ym) +
    contribuicaoFixasMes(despesasFixas, ym, mesReal) +
    totalVeiculoMes(veiculo, ym, mesReal)
  );
}

export function resumoMesCompleto(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
): ResumoMesCompleto {
  const r = totalDoMes(receitas, ym);
  const d = despesaRealizadaMes(despesasCorrentes, despesasFixas, veiculo, ym, mesReal);
  return { receitas: r, despesas: d, saldo: r - d };
}
