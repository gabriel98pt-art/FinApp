// @vitest-environment jsdom

// CopilotoCard é o único lugar que liga as três camadas locais
// (responderPergunta, responderPlano, responderCenarios) à camada 2 (IA) e
// decide, pergunta a pergunta, qual delas responde — e não tinha teste
// nenhum. O que mais importa verificar aqui não é o texto de cada resposta
// (isso já é coberto a fundo em copiloto.test.ts/copilotoPlano.test.ts), mas
// o ENCADEAMENTO: a camada 2 só é chamada quando as locais falham, a corrida
// (`pedidoAtual`) não deixa uma resposta lenta e desactualizada da IA
// sobrepor-se a uma pergunta mais recente, e a única ação executável do
// plano (separar para um fundo) só corre depois de confirmação explícita.

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Fundo } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";
import { responderConfirmacao } from "../stores/confirmarStore";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let fundos: Fundo[] = [];
let saldosIniciais: Record<string, number> = {};

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/eventosStore", () => ({
  useEventosStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/fundosStore", () => ({
  useFundosStore: (s: (e: unknown) => unknown) => s(lista(fundos)),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-07" }),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({
      cfg: { ...CONFIG_PADRAO, saldosIniciais },
      carregado: true,
      erro: false,
    }),
}));
vi.mock("../stores/toastStore", () => ({ mostrarToast: vi.fn() }));

const responderComIA = vi.fn();
vi.mock("../services/copilotoIA", () => ({
  responderComIA: (...a: unknown[]) => responderComIA(...(a as [])),
}));

const contribuirFundo = vi.fn(async () => {});
vi.mock("../services/fundosService", () => ({
  contribuirFundo: (...a: unknown[]) => contribuirFundo(...(a as [])),
}));

const CopilotoCard = (await import("./CopilotoCard")).default;
const { mostrarToast } = await import("../stores/toastStore");

const viagem: Fundo = {
  id: "fundo1",
  nome: "Viagem",
  alvo: 90000,
  atual: 0,
  prazo: "2026-09-30",
};

beforeEach(() => {
  fundos = [];
  saldosIniciais = {};
  responderComIA.mockReset();
  contribuirFundo.mockClear();
  vi.mocked(mostrarToast).mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 15, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CopilotoCard: encadeamento das camadas", () => {
  test("pergunta que a camada 1 sabe responder nunca chega à IA", async () => {
    render(<CopilotoCard />);
    await userEvent.click(screen.getByRole("button", { name: "qual meu saldo?" }));

    expect(await screen.findByText(/receitas menos despesas/)).toBeInTheDocument();
    expect(responderComIA).not.toHaveBeenCalled();
  });

  test("pergunta que nenhuma camada local sabe responder mostra 'A pensar…' e depois a resposta da IA", async () => {
    let resolver: ((v: string) => void) | undefined;
    responderComIA.mockImplementation(() => new Promise<string>((resolve) => (resolver = resolve)));

    render(<CopilotoCard />);
    await userEvent.type(
      screen.getByPlaceholderText(/quanto gastei/i),
      "xyzpergunta sem nenhum intent conhecido",
    );
    await userEvent.click(screen.getByRole("button", { name: "Perguntar" }));

    await screen.findByText("A pensar…");
    expect(responderComIA).toHaveBeenCalledTimes(1);

    resolver?.("Resposta escrita pela camada 2.");
    await waitFor(() => expect(screen.queryByText("A pensar…")).not.toBeInTheDocument());
    expect(await screen.findByText("Resposta escrita pela camada 2.")).toBeInTheDocument();
  });

  test("uma pergunta nova não deixa a resposta lenta da IA da pergunta anterior aparecer por cima", async () => {
    let resolverLenta: ((v: string) => void) | undefined;
    let resolverRapida: ((v: string) => void) | undefined;
    responderComIA
      .mockImplementationOnce(() => new Promise<string>((resolve) => (resolverLenta = resolve)))
      .mockImplementationOnce(() => new Promise<string>((resolve) => (resolverRapida = resolve)));

    render(<CopilotoCard />);
    const campo = screen.getByPlaceholderText(/quanto gastei/i);
    const botao = screen.getByRole("button", { name: "Perguntar" });

    await userEvent.type(campo, "primeira pergunta sem intent");
    await userEvent.click(botao);
    await userEvent.clear(campo);
    await userEvent.type(campo, "segunda pergunta sem intent");
    await userEvent.click(botao);

    expect(responderComIA).toHaveBeenCalledTimes(2);

    // A pergunta mais recente resolve primeiro; a mais antiga só resolve depois.
    resolverRapida?.("Resposta da segunda pergunta.");
    await screen.findByText("Resposta da segunda pergunta.");

    resolverLenta?.("Resposta da primeira pergunta — não devia aparecer.");
    await waitFor(() => expect(screen.queryByText("A pensar…")).not.toBeInTheDocument());
    expect(screen.getByText("Resposta da segunda pergunta.")).toBeInTheDocument();
    expect(
      screen.queryByText("Resposta da primeira pergunta — não devia aparecer."),
    ).not.toBeInTheDocument();
  });

  test("ação do plano (separar para um fundo) só corre depois de confirmar, e some da tela em seguida", async () => {
    fundos = [viagem];
    saldosIniciais = { Conta: 50000 };

    render(<CopilotoCard />);
    await userEvent.click(screen.getByRole("button", { name: "o que eu devo fazer?" }));

    const acao = await screen.findByRole("button", { name: /Separar.*Viagem/ });
    await userEvent.click(acao);
    expect(contribuirFundo).not.toHaveBeenCalled();

    responderConfirmacao(true);
    await waitFor(() => expect(contribuirFundo).toHaveBeenCalledTimes(1));
    expect(contribuirFundo).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ id: "fundo1" }),
      30000,
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Separar.*Viagem/ })).not.toBeInTheDocument(),
    );
  });
});
