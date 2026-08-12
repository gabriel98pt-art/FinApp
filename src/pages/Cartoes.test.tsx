// @vitest-environment jsdom

// Cartões calcula o valor das faturas a partir de cinco domínios. O aviso de
// sincronização é o que impede um "Devido no mês" MENOR do que o real de
// passar por número certo — e uma fatura que parece mais barata leva a pagar
// a menos, coisa que só se descobre no mês seguinte.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ConfigConta, DespesaCorrente, Transferencia } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/faturaService", () => ({
  pagarFatura: vi.fn(async () => {}),
  removerPagamentoFatura: vi.fn(async () => {}),
  reabrirFatura: vi.fn(async () => {}),
}));
vi.mock("../services/cfgService", () => ({
  adicionarCartao: vi.fn(async () => {}),
  removerCartao: vi.fn(async () => {}),
  renomearCartao: vi.fn(async () => {}),
  definirDiaVencimentoFatura: vi.fn(async () => {}),
  definirDiaFechamentoFatura: vi.fn(async () => {}),
  definirFaturaManual: vi.fn(async () => {}),
  definirSaldoInicial: vi.fn(async () => {}),
}));

const CARTAO = "AB Gold (C)";
// Anotado como ConfigConta e não inferido do valor inicial: sem a anotação, o
// TypeScript fecha `tipoCartao` no literal `{ "AB Gold (C)": "credit" }` e o
// teste que reatribui um `{}` (para o caso "sem contas") deixa de compilar.
let cfg: ConfigConta = {
  ...CONFIG_PADRAO,
  contasCartoes: [CARTAO],
  tipoCartao: { [CARTAO]: "credit" },
};
let despesas = lista<DespesaCorrente>();
let transferencias = lista<Transferencia>();
let veiculo = veiculoVazio();

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(transferencias),
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculo),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: Object.assign(
    (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
    { getState: () => ({ cfg }) },
  ),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Cartoes = (await import("./Cartoes")).default;

beforeEach(() => {
  cfg = { ...CONFIG_PADRAO, contasCartoes: [CARTAO], tipoCartao: { [CARTAO]: "credit" } };
  despesas = lista<DespesaCorrente>();
  transferencias = lista<Transferencia>();
  veiculo = veiculoVazio();
});

describe("Cartoes", () => {
  test("monta e mostra os KPIs da fatura", () => {
    render(<Cartoes />);
    expect(screen.getByRole("heading", { name: "Cartões" })).toBeInTheDocument();
    expect(screen.getByText("Devido no mês")).toBeInTheDocument();
  });

  test("sem contas configuradas: convida a adicionar a primeira", () => {
    cfg = { ...CONFIG_PADRAO, contasCartoes: [], tipoCartao: {} };
    render(<Cartoes />);
    expect(screen.getByText("Nenhuma conta ou cartão")).toBeInTheDocument();
  });

  test("com conta: mostra o quadro dela", () => {
    render(<Cartoes />);
    // O nome aparece duas vezes na página — no quadro da conta e na chip do
    // painel de gerir contas lá em baixo. Aqui interessa o quadro, que é o
    // botão que abre os detalhes. (Nada de `new RegExp(nome)`: os parênteses
    // do nome virariam grupo de captura e deixavam de casar com o literal.)
    const quadros = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes(CARTAO) && b.textContent?.includes("crédito"));
    expect(quadros).toHaveLength(1);
  });

  test("falha num domínio que alimenta os valores levanta o aviso", () => {
    // Era o buraco: só o erro das transferências estava a ser verificado, e as
    // faturas vêm dos outros cinco.
    despesas = listaComErro<DespesaCorrente>();
    render(<Cartoes />);
    expect(screen.getByText(/Alguns valores não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha do veículo", () => {
    veiculo = { ...veiculoVazio(), erro: true };
    render(<Cartoes />);
    expect(screen.getByText(/Alguns valores não sincronizaram/)).toBeInTheDocument();
  });

  test("sem transferências no mês: estado vazio próprio da secção", () => {
    render(<Cartoes />);
    expect(screen.getByText(/Nenhuma transferência em agosto 2026/)).toBeInTheDocument();
  });

  test("'Transferências entre contas' é cabeçalho de secção", () => {
    render(<Cartoes />);
    expect(
      screen.getByRole("heading", { name: "Transferências entre contas" }),
    ).toBeInTheDocument();
  });
});
