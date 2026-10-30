// Pagamento (parcial e total) de uma fatura com uma parcela em débito
// automático: o dinheiro conta uma vez só, no mês em que saiu, em todos os
// ecrãs — Início (resultadoDoMes), Análise, Metas (poupancaMeses) — e o saldo
// da conta desce pelo que foi pago, nem mais nem menos.
//
// Cenário: fatura da Visa de julho = jantar de 50 (junho, já contado em junho)
// + parcela da TV de 100 em débito automático. Devido 150.

import { describe, expect, test } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta, DadosVeiculo, DespesaCorrente, Parcela } from "../types";
import { analisarMes, type DadosAnalise } from "./analise";
import { resumoDaConta } from "./contas";
import { poupancaMeses } from "./metas";
import { resultadoDoMes } from "./resumoMensal";

const veiculo: DadosVeiculo = { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] };
const cfg: ConfigConta = {
  ...CONFIG_PADRAO,
  contasCartoes: ["Visa", "Conta"],
  tipoCartao: { Visa: "credit", Conta: "debit" },
  saldosIniciais: { Conta: 300000 },
};
const tv: Parcela = {
  id: "P",
  descricao: "TV",
  total: 60000,
  numParcelas: 6,
  primeiroMes: "2026-06",
  cartao: "Visa",
  autoDebit: true,
  pagoPorMes: {},
};
const jantar: DespesaCorrente = {
  id: "j",
  descricao: "Jantar",
  valor: 5000,
  data: "2026-06-10",
  categoria: "Restaurante",
  contaCartao: "Visa",
};
const pagamento = (id: string, valor: number, data: string): DespesaCorrente => ({
  id,
  descricao: "Cartão de Crédito Visa",
  valor,
  data,
  categoria: "Cartão de Crédito",
  contaCartao: "Conta",
  origem: "fat",
  fatCartao: "Visa",
  fatMes: "2026-07",
});
const espelho = (id: string, valor: number, data: string, fatPagId?: string): DespesaCorrente => ({
  id,
  descricao: "TV",
  valor,
  data,
  categoria: "Parcelas",
  origem: "parc",
  parcelaId: "P",
  parcelaMes: "2026-06",
  ...(fatPagId ? { fatPagId } : {}),
});

const HOJE = "2026-07-20";
const julho = (despesas: DespesaCorrente[]) =>
  resultadoDoMes([], despesas, [], veiculo, "2026-07", "2026-07", HOJE).despesas;
const junho = (despesas: DespesaCorrente[]) =>
  resultadoDoMes([], despesas, [], veiculo, "2026-06", "2026-07", HOJE).despesas;

describe("pagamento parcial de fatura — o dinheiro conta no mês em que saiu", () => {
  // 100 de 150 pagos: a parte da parcela é 100 × 100/150 = 66,67.
  const parcial = [
    jantar,
    pagamento("f1", 10000, "2026-07-05"),
    espelho("e1", 6667, "2026-07-05", "f1"),
  ];

  test("Início: julho mostra a parte da parcela que já saiu; junho não muda", () => {
    expect(julho(parcial)).toBe(6667);
    expect(junho(parcial)).toBe(5000);
  });

  test("antes do ajuste (sem espelho) julho ficava em 0: o dinheiro estava invisível", () => {
    expect(julho([jantar, pagamento("f1", 10000, "2026-07-05")])).toBe(0);
  });

  test("ao quitar, o total da parcela é o valor dela, uma vez só", () => {
    const quitada = [
      ...parcial,
      pagamento("f2", 5000, "2026-07-18"),
      espelho("e2", 3333, "2026-07-18"),
    ];
    expect(julho(quitada)).toBe(10000);
    expect(junho(quitada)).toBe(5000);
  });

  test("Análise: as semanas de julho somam o total do mês", () => {
    const d: DadosAnalise = {
      receitas: [],
      despesasCorrentes: parcial,
      despesasFixas: [],
      parcelas: [tv],
      transferencias: [],
      veiculo,
    };
    const a = analisarMes(d, { diaInicioSemana: 1 }, "2026-07", "2026-07", HOJE, 3);
    expect(a.meses[a.meses.length - 1].despesas).toBe(6667);
    expect(a.semanas.barras.reduce((s, b) => s + b.valor, 0)).toBe(6667);
  });

  test("Metas: o Poupado conta o espelho no mês do pagamento", () => {
    const receitas = [
      { id: "r", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
    ];
    expect(poupancaMeses(receitas, parcial, [], veiculo, ["2026-07"], "2026-07", HOJE)).toBe(
      200000 - 6667,
    );
  });

  test("o saldo da conta desce só o que foi pago (o espelho não tem conta)", () => {
    const dados = {
      receitas: [],
      despesasCorrentes: parcial,
      despesasFixas: [],
      despesasFixasVeiculo: [],
      transferencias: [],
      cargas: [],
      despesasVeiculo: [],
      parcelas: [tv],
    };
    expect(resumoDaConta("Conta", dados, cfg, "2026-07", HOJE).saldoAtual).toBe(300000 - 10000);
  });
});
