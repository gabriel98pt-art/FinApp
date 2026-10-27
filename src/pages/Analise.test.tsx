// @vitest-environment jsdom

// A página Análise: o que mostra, o estado vazio, o seletor de período, o modo
// discreto — e que os números do mês são os MESMOS do "Resultado do mês" da
// Início, porque saem da mesma conta.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ConfigConta, DespesaCorrente, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();
let cfgTeste: ConfigConta = CONFIG_PADRAO;

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
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
vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) => s({ abrirRegistro: vi.fn() }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Analise = (await import("./Analise")).default;
const Inicio = (await import("./Inicio")).default;

const rec = (id: string, data: string, valor: number) =>
  ({ id, descricao: `Receita ${id}`, valor, data, fonte: "Trabalho" }) as Receita;
const desp = (id: string, data: string, valor: number, categoria = "Alimentação") =>
  ({ id, descricao: `Gasto ${id}`, valor, data, categoria }) as DespesaCorrente;

function comHistorico() {
  receitas = lista<Receita>([
    rec("r5", "2026-05-01", 200000),
    rec("r6", "2026-06-01", 200000),
    rec("r7", "2026-07-01", 200000),
    rec("r8", "2026-08-01", 250000),
  ]);
  despesas = lista<DespesaCorrente>([
    desp("d5", "2026-05-10", 100000),
    desp("d6", "2026-06-10", 100000),
    desp("d7", "2026-07-10", 100000),
    desp("d8a", "2026-08-03", 120000, "Casa"),
    desp("d8b", "2026-08-12", 60000),
  ]);
}

const desenhar = () =>
  render(
    <MemoryRouter>
      <Analise />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-20T12:00:00"));
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  cfgTeste = CONFIG_PADRAO;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Analise", () => {
  test("sem dados nenhuns mostra o estado vazio", () => {
    desenhar();
    expect(screen.getByRole("heading", { name: "Análise" })).toBeInTheDocument();
    expect(screen.getByText("Ainda não há dados para analisar")).toBeInTheDocument();
  });

  test("com histórico mostra as seis secções pela ordem da prévia", () => {
    comHistorico();
    desenhar();
    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual([
      "Taxa de poupança",
      "Agosto vs a sua média",
      "Receitas vs despesas",
      "Gasto por semana",
      "Categorias mês a mês",
      "Maiores gastos do mês",
    ]);
  });

  test("cada gráfico traz o resumo em texto", () => {
    comHistorico();
    desenhar();
    expect(
      screen.getByRole("img", { name: /Receitas e despesas de mai a ago/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Gasto por semana\. S1/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Taxa de poupança: 28%" })).toBeInTheDocument();
  });

  test("a taxa e o 'guardou' são os do mês: 2.500 de receita, 1.800 de despesa", () => {
    comHistorico();
    desenhar();
    expect(screen.getByText(/Guardou/)).toHaveTextContent("Guardou € 700 de € 2.500");
    // média das taxas de mai a ago: 50, 50, 50, 28 → 45.
    expect(screen.getByText(/Média dos 4 meses: 45%/)).toBeInTheDocument();
  });

  test("a despesa acima da média leva o chip ▲, lido como pior", () => {
    comHistorico();
    desenhar();
    const vs = screen.getByRole("region", { name: "Agosto vs a sua média" });
    const despesasLinha = within(vs).getByText("Despesas").closest("div")!.parentElement!;
    // 1.800 contra a média de 1.000: +80%.
    expect(despesasLinha).toHaveTextContent("▲ 80%");
    expect(despesasLinha).toHaveTextContent("80% acima da média, pior");
  });

  test("a Início e a Análise dão o mesmo número para o mesmo mês", () => {
    comHistorico();
    const inicio = render(
      <MemoryRouter>
        <Inicio />
      </MemoryRouter>,
    );
    // O número grande do Resultado do mês, já sem os cêntimos.
    const resultado = screen.getByRole("img", { name: "€ 700,00" });
    expect(resultado).toBeInTheDocument();
    const totalReceitas = screen.getByRole("button", { name: /Receitas/ }).textContent;
    const totalDespesas = screen.getByRole("button", { name: /Despesas/ }).textContent;
    expect(totalReceitas).toContain("€ 2.500,00");
    expect(totalDespesas).toContain("€ 1.800,00");
    inicio.unmount();

    desenhar();
    const vs = screen.getByRole("region", { name: "Agosto vs a sua média" });
    expect(within(vs).getByText("Receitas").closest("div")!.parentElement).toHaveTextContent(
      "€ 2.500",
    );
    expect(within(vs).getByText("Despesas").closest("div")!.parentElement).toHaveTextContent(
      "€ 1.800",
    );
    expect(within(vs).getByText("Sobra").closest("div")!.parentElement).toHaveTextContent("€ 700");
  });

  test("o seletor tem 3, 6 e 12 meses, com 6 por omissão", () => {
    comHistorico();
    desenhar();
    const grupo = screen.getByRole("radiogroup", { name: "Período da análise" });
    const radios = within(grupo).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["3 meses", "6 meses", "12 meses"]);
    expect(within(grupo).getByRole("radio", { name: "6 meses" })).toBeChecked();
    fireEvent.click(within(grupo).getByRole("radio", { name: "3 meses" }));
    expect(within(grupo).getByRole("radio", { name: "3 meses" })).toBeChecked();
    // Com 3 meses a janela é jun, jul, ago.
    expect(
      screen.getByRole("img", { name: /Receitas e despesas de jun a ago/ }),
    ).toBeInTheDocument();
  });

  test("modo discreto: os valores levam a classe que os esconde", () => {
    comHistorico();
    cfgTeste = { ...CONFIG_PADRAO, modoDiscreto: true };
    desenhar();
    screen.getAllByText("€ 700").forEach((el) => expect(el.closest(".discreto")).not.toBeNull());
    expect(document.querySelectorAll(".discreto").length).toBeGreaterThan(3);
  });

  test("um mês só de dados: aparece o que dá para calcular, sem gráfico nem média", () => {
    receitas = lista<Receita>([rec("r8", "2026-08-01", 100000)]);
    despesas = lista<DespesaCorrente>([desp("d8", "2026-08-05", 25000)]);
    desenhar();
    expect(screen.getByText(/Guardou/)).toHaveTextContent("Guardou € 750 de € 1.000");
    expect(screen.queryByRole("heading", { name: "Receitas vs despesas" })).not.toBeInTheDocument();
    expect(screen.queryByText(/vs a sua média/)).not.toBeInTheDocument();
    expect(screen.getByText(/Com mais um mês de histórico/)).toBeInTheDocument();
  });

  test("receita zero: a taxa é um travessão, não NaN", () => {
    despesas = lista<DespesaCorrente>([desp("d8", "2026-08-05", 25000)]);
    desenhar();
    expect(screen.getByText("Sem receitas neste mês")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Taxa de poupança: sem receitas" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|∞/);
  });
});
