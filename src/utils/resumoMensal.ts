// "Despesa realizada do mês" combinando despesas correntes + veículo — fonte
// única usada em Início, Despesas, Metas, Resumo Anual e Copiloto, pra nunca
// divergir entre telas (seção 3 / 4.8).

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  Receita,
  YearMonth,
} from "../types";
import { despesasNosTotais, mesesRecentes, receitasNosTotais, totalDoMes } from "./calculos";
import { contribuicaoFixasMes } from "./despesasFixas";
import { contribuicaoParcelasMes } from "./parcelas";
import { totalVeiculoMes } from "./veiculo";

export interface ResumoMesCompleto {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Despesa do mês = despesas correntes reais (sem pagamento de fatura, sem
 *  espelho de parcela) + despesas fixas gerais + parcelas + total do veículo
 *  (cargas + despesas + fixas — seção "Parte A").
 *
 *  Fixas, parcelas e veículo seguem todos a MESMA regra: mês corrente conta só
 *  o que foi marcado pago, mês fechado conta o valor cheio de tudo que está no
 *  prazo, pago ou não. */
export function despesaRealizadaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  /** Dia de hoje — dá precisão de dia ao mês corrente (ver `estaEfetivamentePaga`/
   *  `fixaEfetivamentePaga`): uma cobrança do dia 27 não conta como despesa
   *  realizada no dia 8. Opcional, mesmo mês inteiro de sempre sem ele. */
  hoje?: IsoDate,
): Cents {
  return (
    totalDoMes(despesasNosTotais(despesasCorrentes), ym) +
    contribuicaoFixasMes(despesasFixas, ym, mesReal, hoje) +
    contribuicaoParcelasMes(parcelas, ym, mesReal, hoje) +
    totalVeiculoMes(veiculo, ym, mesReal, hoje)
  );
}

export function resumoMesCompleto(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): ResumoMesCompleto {
  const r = totalDoMes(receitasNosTotais(receitas), ym);
  const d = despesaRealizadaMes(
    despesasCorrentes,
    despesasFixas,
    parcelas,
    veiculo,
    ym,
    mesReal,
    hoje,
  );
  return { receitas: r, despesas: d, saldo: r - d };
}

/** Uma célula da grade do Resumo Anual: o mês e se ele ainda não chegou. */
export interface CelulaJanela {
  ym: YearMonth;
  /** Mês depois de HOJE — sem despesa realizada, e fora dos totais. */
  futuro: boolean;
}

/** Os `n` meses que a grade mostra, terminando em `ate`.
 *
 *  `ate` e `mesReal` são coisas diferentes de propósito: `ate` é só onde a
 *  janela termina (o Início ancora-a no mês do seletor; Metas deixa em hoje),
 *  enquanto `mesReal` é hoje de verdade e é o único que decide o que é
 *  "futuro". Olhar um mês passado não torna os meses seguintes futuros, e
 *  olhar um mês adiante não torna passado o que ainda não aconteceu. */
export function janelaResumoAnual(n: number, ate: YearMonth, mesReal: YearMonth): CelulaJanela[] {
  return mesesRecentes(n, ate).map((ym) => ({ ym, futuro: ym > mesReal }));
}
