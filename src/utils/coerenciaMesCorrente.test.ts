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
import type { DadosVeiculo, DespesaCorrente, Parcela } from "../types";
import { despesaPorCategoriaMes } from "./despesaPorCategoria";
import { gastosDaCategoriaMes, statusOrcamentoMes } from "./orcamento";
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

// A lista que a folha do teto mostra é a PROVA VISUAL do número que está por
// cima dela. Se as duas não fecharem, a folha contradiz-se sozinha — e é a
// mesma família de defeito: dois caminhos a responder à mesma pergunta.
describe("a lista da folha do teto soma exatamente o gasto do orçamento", () => {
  const correntes: DespesaCorrente[] = [
    { id: "d1", descricao: "Cinema", valor: 2000, data: "2026-07-03", categoria: "Lazer" },
    { id: "d2", descricao: "Concerto", valor: 6000, data: "2026-07-12", categoria: "Lazer" },
    // Reembolso: negativo, e tem de aparecer na lista a puxar o total para
    // baixo — senão a soma da lista fica acima do gasto.
    {
      id: "d3",
      descricao: "Devolução do bilhete",
      valor: -1500,
      data: "2026-07-14",
      categoria: "Lazer",
      origem: "reemb",
    },
    // Fora dos totais: pagamento de fatura e espelho de parcela.
    {
      id: "d4",
      descricao: "Pagamento fatura",
      valor: 50000,
      data: "2026-07-15",
      categoria: "Lazer",
      origem: "fat",
    },
    { id: "d5", descricao: "Mercado", valor: 9000, data: "2026-07-08", categoria: "Alimentação" },
  ] as DespesaCorrente[];

  const soma = (hoje: string) =>
    gastosDaCategoriaMes(correntes, [parcela], "Lazer", MES, MES, hoje).reduce(
      (s, t) => s + t.valor,
      0,
    );
  const gasto = (hoje: string) =>
    statusOrcamentoMes(correntes, [parcela], { Lazer: 100000 }, MES, MES, hoje)[0].gasto;

  test("antes do vencimento da parcela", () => {
    expect(soma("2026-07-05")).toBe(gasto("2026-07-05"));
  });

  test("depois do vencimento da parcela", () => {
    expect(soma("2026-07-25")).toBe(gasto("2026-07-25"));
  });

  test("todos os dias do mês, sem um único em que a lista minta", () => {
    for (let d = 1; d <= 31; d++) {
      const hoje = `${MES}-${String(d).padStart(2, "0")}`;
      expect({ hoje, soma: soma(hoje) }).toEqual({ hoje, soma: gasto(hoje) });
    }
  });

  test("a lista traz o reembolso e deixa de fora o que não conta nos totais", () => {
    const titulos = gastosDaCategoriaMes(correntes, [parcela], "Lazer", MES, MES, "2026-07-25").map(
      (t) => t.titulo,
    );
    expect(titulos).toContain("Devolução do bilhete");
    expect(titulos).not.toContain("Pagamento fatura");
    // E nada de outra categoria.
    expect(titulos).not.toContain("Mercado");
  });

  test("mostra a parcela só depois de ela vencer, como o extrato", () => {
    const nomes = (hoje: string) =>
      gastosDaCategoriaMes(correntes, [parcela], "Lazer", MES, MES, hoje).map((t) => t.titulo);
    expect(nomes("2026-07-05").some((n) => n.startsWith("Consola"))).toBe(false);
    expect(nomes("2026-07-25").some((n) => n.startsWith("Consola"))).toBe(true);
  });
});

// A mesma coerência, mas olhando um mês FUTURO pelo seletor do header
// (Despesas, Planejamento) — alcançável normalmente, sem nada de especial: a
// seta "mês seguinte" não tem limite. `statusOrcamentoMes` só tratava o mês
// CORRENTE como exceção (`ym === mesReal`); um mês futuro caía na regra de
// "mês fechado" e contava a parcela cheia, mesmo sem ter vencido — enquanto
// `gastosDaCategoriaMes` (que decide por `ym < mesReferencia`, não por
// `===`) continuava a excluí-la. O card dizia "Lazer estourou" e a folha de
// edição, aberta para mostrar de onde vinha esse gasto, aparecia vazia.
describe("a mesma conta, olhando um mês futuro", () => {
  const mesReal = "2026-06";
  const hoje = "2026-06-15";

  test("parcela de um mês futuro, ainda sem vencer: nenhum dos dois conta", () => {
    expect(statusOrcamentoMes([], [parcela], { Lazer: 100000 }, MES, mesReal, hoje)[0].gasto).toBe(
      0,
    );
    expect(gastosDaCategoriaMes([], [parcela], "Lazer", MES, mesReal, hoje)).toHaveLength(0);
  });

  test("marcada paga à mão, mesmo um mês futuro: os dois concordam", () => {
    const paga: Parcela = { ...parcela, pagoPorMes: { [MES]: true } };
    const gasto = statusOrcamentoMes([], [paga], { Lazer: 100000 }, MES, mesReal, hoje)[0].gasto;
    const soma = gastosDaCategoriaMes([], [paga], "Lazer", MES, mesReal, hoje).reduce(
      (s, t) => s + t.valor,
      0,
    );
    expect(soma).toBe(gasto);
    expect(gasto).toBeGreaterThan(0);
  });
});
