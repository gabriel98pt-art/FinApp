// As telas têm de concordar sobre o mesmo dinheiro.
//
// O bug que deu origem a este ficheiro: o orçamento avisava que "Lazer"
// estourou o teto, e ao filtrar Transações por "Lazer" a soma dava MENOS. A
// diferença era exatamente uma parcela em débito automático que ainda não
// tinha vencido — `transacoesDoMes` e `despesaRealizadaMes` recebiam o dia de
// hoje e esperavam por ele, `statusOrcamentoMes` e `despesaPorCategoriaMes`
// não recebiam e contavam o mês inteiro desde o dia 1.
//
// Cada uma das quatro funções tem os seus próprios testes de dia. O que ESTE
// ficheiro protege é outra coisa: que elas concordem UMAS COM AS OUTRAS. É uma
// contradição entre telas, e nenhum teste de uma peça só a apanha — foi assim
// que ela chegou ao usuário.

import { describe, expect, test } from "vitest";
import type { DadosVeiculo, Parcela } from "../types";
import { despesaPorCategoriaMes } from "./despesaPorCategoria";
import { statusOrcamentoMes } from "./orcamento";
import { despesaRealizadaMes } from "./resumoMensal";
import { transacoesDoMes } from "./transacoes";

const MES = "2026-07";
const SEM_VEICULO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};

/** 300 € em 3× no cartão, em débito automático, a vencer dia 20. */
const parcela: Parcela = {
  id: "p1",
  descricao: "Consola",
  total: 30000,
  numParcelas: 3,
  primeiroMes: MES,
  categoria: "Lazer",
  cartao: "Visa",
  autoDebit: true,
  diaVencimento: 20,
  pagoPorMes: {},
};

const dadosTransacoes = {
  receitas: [],
  despesasCorrentes: [],
  despesasFixas: [],
  parcelas: [parcela],
  transferencias: [],
  veiculo: SEM_VEICULO,
};

/** As quatro respostas à mesma pergunta: os 100 € desta parcela já contam? */
function jaContam(hoje: string) {
  return {
    orcamento: statusOrcamentoMes([], [parcela], { Lazer: 5000 }, MES, MES, hoje)[0].gasto > 0,
    donut: despesaPorCategoriaMes([], [], [parcela], SEM_VEICULO, MES, MES, hoje).some(
      (f) => f.categoria === "Lazer",
    ),
    totalDoMes: despesaRealizadaMes([], [], [parcela], SEM_VEICULO, MES, MES, hoje) > 0,
    extrato: transacoesDoMes(dadosTransacoes, MES, MES, hoje).some((t) => t.categoria === "Lazer"),
  };
}

describe("orçamento, donut, total do mês e extrato concordam", () => {
  test("antes do vencimento: nenhum conta", () => {
    // O caso reportado. Antes da correção, orçamento e donut diziam `true` aqui
    // enquanto o extrato dizia `false` — e era essa a conta que não fechava.
    expect(jaContam("2026-07-05")).toEqual({
      orcamento: false,
      donut: false,
      totalDoMes: false,
      extrato: false,
    });
  });

  test("no dia do vencimento: todos contam", () => {
    expect(jaContam("2026-07-20")).toEqual({
      orcamento: true,
      donut: true,
      totalDoMes: true,
      extrato: true,
    });
  });

  test("depois do vencimento: todos contam", () => {
    expect(jaContam("2026-07-25")).toEqual({
      orcamento: true,
      donut: true,
      totalDoMes: true,
      extrato: true,
    });
  });

  test("o mês inteiro, dia a dia, sem um único dia em desacordo", () => {
    // A varredura é o ponto: um caso isolado prova pouco quando a divergência
    // era precisamente numa fronteira de dia. Aqui não interessa QUAL é a
    // resposta em cada dia — interessa que seja a MESMA nas quatro.
    for (let d = 1; d <= 31; d++) {
      const hoje = `${MES}-${String(d).padStart(2, "0")}`;
      const r = jaContam(hoje);
      expect({ hoje, ...r }).toEqual({
        hoje,
        orcamento: r.extrato,
        donut: r.extrato,
        totalDoMes: r.extrato,
        extrato: r.extrato,
      });
    }
  });
});
