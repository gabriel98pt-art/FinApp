// @vitest-environment jsdom

// Início não tem lista própria: só totais, somados a partir de cinco domínios.
// É por isso que o aviso de sincronização importa mais aqui do que noutras
// telas — um total incompleto é indistinguível de um total certo, e com a
// subscrição caída no arranque o número é "€ 0,00", que se lê como "não tens
// nada" em vez de "não conseguimos saber".

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ConfigConta, DespesaCorrente, DespesaFixa, Parcela, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();
let fixas = lista();
let parcelas = lista();
let veiculo = veiculoVazio();
let cfgTeste: ConfigConta = CONFIG_PADRAO;

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(fixas),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(parcelas),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculo),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg: cfgTeste, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Inicio = (await import("./Inicio")).default;

const desenhar = () =>
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );

beforeEach(() => {
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  fixas = lista();
  parcelas = lista();
  veiculo = veiculoVazio();
  cfgTeste = CONFIG_PADRAO;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Inicio", () => {
  test("monta e mostra o resultado do mês com os totais de receitas e despesas", () => {
    desenhar();
    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resultado do mês" })).toBeInTheDocument();
    // Por `role`: os dois totais são botões porque navegam para a tela
    // respectiva — e é isso que os distingue do texto à volta.
    expect(screen.getByRole("button", { name: /Receitas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Despesas/ })).toBeInTheDocument();
  });

  test("saldo positivo: receitas maiores que despesas, sem sinal", () => {
    receitas = lista<Receita>([
      { id: "r1", descricao: "Corridas", valor: 150000, data: "2026-08-02" } as Receita,
    ]);
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 40000,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();
    expect(screen.getByRole("img", { name: "€ 1.100,00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Receitas/ })).toHaveTextContent("€ 1.500,00");
    expect(screen.getByRole("button", { name: /Despesas/ })).toHaveTextContent("€ 400,00");
  });

  test("saldo negativo: despesas maiores que receitas, com o menos antes do símbolo", () => {
    receitas = lista<Receita>([
      { id: "r1", descricao: "Corridas", valor: 100000, data: "2026-08-02" } as Receita,
    ]);
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Renda",
        valor: 150700,
        data: "2026-08-03",
        categoria: "Aluguel",
      } as DespesaCorrente,
    ]);
    desenhar();
    expect(screen.getByRole("img", { name: "−€ 507,00" })).toBeInTheDocument();
  });

  test("sem nenhum movimento o saldo é zero e não negativo", () => {
    desenhar();
    expect(screen.getByRole("img", { name: "€ 0,00" })).toBeInTheDocument();
  });

  // Bug relatado pelo Gabriel em 01/09/2026: pagou uma parcela referente a
  // Agosto já em Setembro, e o KPI "Despesas" do mês não refletiu — porque
  // usava o total por CRONOGRAMA (despesaRealizadaMes), não por quando o
  // dinheiro saiu de verdade. Agora é despesaRegistradaMes (fluxo de caixa).
  test('"Despesas" conta pela data real do lançamento, não pelo mês de referência da parcela', () => {
    // mesVisivelStore está fixo em "2026-08" (topo do ficheiro). O espelho
    // da parcela é de Agosto (parcelaMes), mas foi pago em Setembro (data) —
    // não deve entrar no total de Agosto.
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Advogado",
        valor: 10000,
        data: "2026-09-01",
        categoria: "Parcelas",
        origem: "parc",
        parcelaId: "p1",
        parcelaMes: "2026-08",
      } as DespesaCorrente,
    ]);
    desenhar();
    const botao = screen.getByRole("button", { name: /Despesas/ });
    expect(botao).toHaveTextContent("€ 0,00");
  });

  test("tudo sincronizado: nenhum aviso", () => {
    desenhar();
    expect(screen.queryByText(/não sincronizaram/)).not.toBeInTheDocument();
  });

  test("um domínio em erro já levanta o aviso", () => {
    receitas = listaComErro<Receita>();
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha do veículo, não só a dos lançamentos", () => {
    // São cinco domínios a alimentar os mesmos quatro números. Olhar só ao
    // primeiro deixava passar em claro uma falha nas parcelas ou no veículo.
    veiculo = { ...veiculoVazio(), erro: true };
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha das fixas — achado da auditoria de Testes/QA: fixture criada e nunca usada", () => {
    fixas = listaComErro();
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha das parcelas", () => {
    parcelas = listaComErro();
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso é a faixa fina — o resultado do mês continua na tela", () => {
    // Compacto e não a caixa cheia: os números continuam a valer, o que caiu
    // foi a actualização.
    receitas = listaComErro<Receita>();
    desenhar();

    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resultado do mês" })).toBeInTheDocument();
  });

  test("os quadros têm cabeçalho de verdade, para se poder saltar entre eles", () => {
    // Eram <p>: quem navega por cabeçalhos não conseguia saltar de um quadro
    // para o outro nesta página, que é a primeira que se abre.
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 3870,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();
    expect(screen.getByRole("heading", { name: "Resultado do mês" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Onde foi o dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Últimos movimentos" })).toBeInTheDocument();
  });

  test("os KPIs, a pizza e o resumo de 6 meses já não estão no Início", () => {
    desenhar();
    expect(screen.queryByText("Saldo do mês")).not.toBeInTheDocument();
    expect(screen.queryByText("Poupança")).not.toBeInTheDocument();
    expect(screen.queryByText("Despesas por categoria")).not.toBeInTheDocument();
    expect(screen.queryByText("Últimos 6 meses")).not.toBeInTheDocument();
  });

  test("Copiloto é uma linha que abre o Copiloto", () => {
    desenhar();
    expect(screen.queryByPlaceholderText(/quanto gastei/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Perguntar ao Copiloto/ }));
    expect(screen.getByPlaceholderText(/quanto gastei/)).toBeInTheDocument();
  });

  describe("A pagar este mês", () => {
    const fixa = (extra: Partial<DespesaFixa>): DespesaFixa => ({
      id: "f1",
      descricao: "Seguro",
      valor: 5400,
      categoria: "Seguros",
      pagoPorMes: {},
      diaVencimento: 20,
      ...extra,
    });
    const parcela = (extra: Partial<Parcela>): Parcela => ({
      id: "p1",
      descricao: "Sofá",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      pagoPorMes: {},
      ...extra,
    });

    beforeEach(() => {
      // O Início olha para o mês de HOJE, não para o do seletor: sem fixar a
      // data o teste passava a depender do dia em que corre.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 7, 10));
    });

    test("sem compromissos a secção não aparece", () => {
      desenhar();
      expect(screen.queryByRole("heading", { name: "A pagar este mês" })).not.toBeInTheDocument();
    });

    test("lista o que falta pagar e soma, sem o que já foi pago", () => {
      fixas = lista<DespesaFixa>([
        fixa({}),
        fixa({ id: "f2", descricao: "Ginásio", valor: 2500, pagoPorMes: { "2026-08": true } }),
      ]);
      parcelas = lista<Parcela>([
        parcela({
          id: "p1",
          descricao: "Monitor",
          primeiroMes: "2026-08",
          numParcelas: 2,
          total: 20000,
          diaVencimento: 28,
        }),
        parcela({
          id: "p2",
          descricao: "Cadeira",
          diaVencimento: 15,
          pagoPorMes: { "2026-08": true },
        }),
      ]);
      desenhar();

      const secao = screen.getByRole("region", { name: "A pagar este mês" });
      expect(within(secao).getByText("Seguro")).toBeInTheDocument();
      expect(within(secao).getByText("Monitor")).toBeInTheDocument();
      expect(within(secao).queryByText("Ginásio")).not.toBeInTheDocument();
      expect(within(secao).queryByText("Cadeira")).not.toBeInTheDocument();
      // 54,00 (seguro) + 100,00 (monitor, 1ª de 2 parcelas)
      expect(within(secao).getByText("€ 154,00")).toBeInTheDocument();
    });

    test("chama 'amanhã' ao dia seguinte", () => {
      fixas = lista<DespesaFixa>([fixa({ diaVencimento: 11 })]);
      desenhar();
      expect(screen.getByText("amanhã")).toBeInTheDocument();
    });

    test("parcela em débito automático num cartão de crédito não aparece: já está na fatura", () => {
      cfgTeste = {
        ...CONFIG_PADRAO,
        contasCartoes: ["Visa"],
        tipoCartao: { Visa: "credit" },
        diaVencimentoFatura: { Visa: 25 },
      };
      // A fatura de agosto cobre o ciclo de julho; a parcela cai aí (2ª de 3,
      // € 100,00) e, por isso, já vai dentro da fatura.
      parcelas = lista<Parcela>([parcela({ cartao: "Visa", autoDebit: true })]);
      desenhar();

      const secao = screen.getByRole("region", { name: "A pagar este mês" });
      expect(within(secao).getByText("Fatura Visa")).toBeInTheDocument();
      expect(within(secao).queryByText("Sofá")).not.toBeInTheDocument();
      // Contado uma vez só: a fatura de € 100,00, não € 200,00.
      expect(within(secao).getAllByText("€ 100,00")).toHaveLength(2); // linha + soma
    });
  });
});
