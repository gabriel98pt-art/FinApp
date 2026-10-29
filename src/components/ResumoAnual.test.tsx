// @vitest-environment jsdom

// O Resumo Anual soma o MESMO dinheiro que o quadro "Resultado do mês" do
// Início, a Análise e o "Poupado (12m)" de Metas (fluxo de caixa: o que saiu
// no mês, pela data de cada lançamento) — e tem de chegar ao mesmo número.
//
// O bug que deu origem a este ficheiro: o componente chamava
// `despesaRealizadaMes` sem o `hoje`, e era o único sítio da app a fazê-lo.
// Sem o dia, o mês corrente contava o valor cheio de tudo que estivesse em
// débito automático a partir do dia 1, mesmo antes do vencimento — a mesma
// família do bug já corrigido nas Metas, no Copiloto, em Transações e no donut
// por categoria.

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DespesaCorrente, DespesaFixa, Parcela, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let fixas = lista<DespesaFixa>();
let parcelas = lista<Parcela>();
let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(fixas),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(parcelas),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));

const ResumoAnual = (await import("./ResumoAnual")).default;

/** O total de despesas do rodapé — o número que tem de bater com o KPI.
 *
 *  O `<span>` do próprio rótulo, e não o rodapé inteiro: o rodapé traz também
 *  Receitas e Saldo, e uma asserção sobre o texto todo passava com o "€ 0,00"
 *  das Receitas mesmo quando as Despesas estavam erradas. */
const despesasDoRodape = () => screen.getByText("Despesas").textContent ?? "";

const desenhar = () => render(<ResumoAnual meses={6} titulo="Resumo Anual" />);

/** Seguro de 200 €, no cartão em débito automático, a vencer dia 27 de agosto.
 *  `inicio` em agosto deixa os outros cinco meses da janela a zero, para o
 *  rodapé mostrar exactamente esta fixa e mais nada. */
const seguro: DespesaFixa = {
  id: "f1",
  descricao: "Seguro",
  valor: 20000,
  categoria: "Seguros",
  inicio: "2026-08",
  contaCartao: "Visa",
  autoDebit: true,
  diaVencimento: 27,
  pagoPorMes: {},
};

/** 300 € em 3×, primeira em agosto, no cartão em débito automático, dia 27. */
const consola: Parcela = {
  id: "p1",
  descricao: "Consola",
  total: 30000,
  numParcelas: 3,
  primeiroMes: "2026-08",
  categoria: "Lazer",
  cartao: "Visa",
  autoDebit: true,
  diaVencimento: 27,
  pagoPorMes: {},
};

beforeEach(() => {
  fixas = lista<DespesaFixa>();
  parcelas = lista<Parcela>();
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResumoAnual: mês corrente respeita o dia de vencimento", () => {
  test("fixa em débito automático fica de fora antes do dia de vencimento", () => {
    vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
    fixas = lista([seguro]);
    desenhar();
    expect(despesasDoRodape()).toContain("€ 0,00");
  });

  test("fixa em débito automático entra a partir do dia de vencimento", () => {
    vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));
    fixas = lista([seguro]);
    desenhar();
    expect(despesasDoRodape()).toContain("€ 200,00");
  });

  test("parcela ainda por pagar não conta: só o dinheiro que saiu", () => {
    // Em fluxo de caixa uma parcela só conta quando o seu pagamento é lançado
    // (o espelho `parc`), nunca pelo calendário de parcelas.
    vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));
    parcelas = lista([consola]);
    desenhar();
    expect(despesasDoRodape()).toContain("€ 0,00");
  });

  test("a parcela paga conta no mês em que foi paga", () => {
    vi.setSystemTime(new Date(2026, 8, 5, 10, 0, 0));
    parcelas = lista([consola]);
    despesas = lista([
      {
        id: "e1",
        descricao: "Consola",
        valor: 10000,
        data: "2026-09-02",
        categoria: "Lazer",
        origem: "parc",
        parcelaId: "p1",
        parcelaMes: "2026-08",
      },
    ]);
    desenhar();
    expect(despesasDoRodape()).toContain("€ 100,00");
  });

  test("o saldo de um mês fechado bate com o do Início: 2.000 de receita e a parcela por pagar", () => {
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    receitas = lista([
      { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
    ]);
    parcelas = lista([
      { ...consola, id: "p2", primeiroMes: "2026-07", total: 60000, numParcelas: 6 },
    ]);
    desenhar();
    // A parcela de julho nunca foi paga: não é dinheiro que saiu.
    expect(screen.getByText("Jul").parentElement!.textContent).toContain("+2.000,00");
  });

  test("fixa marcada à mão entra mesmo antes do dia", () => {
    // A regra não é "esperar sempre pelo dia 27": marcar como paga resolve o
    // mês na hora, venha o débito automático quando vier.
    vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
    fixas = lista([{ ...seguro, pagoPorMes: { "2026-08": true } }]);
    desenhar();
    expect(despesasDoRodape()).toContain("€ 200,00");
  });
});
