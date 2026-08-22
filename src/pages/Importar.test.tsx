// @vitest-environment jsdom

// Importar é a tela onde a pessoa decide o que entra nas contas dela a partir
// de um extrato. Os selos de confiança e os filtros são o que orienta essa
// decisão — e os filtros foram o quarto sítio a receber o padrão de abas.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LinhaAnalisada, LinhaExtrato } from "../types";
import { analisarLinha } from "../utils/importacao";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const extrairExtratoPdf = vi.hoisted(() => vi.fn());
vi.mock("../utils/extrairExtratoPdf", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  extrairExtratoPdf,
}));
vi.mock("../services/importacaoService", () => ({
  apagarExistentes: vi.fn(async () => {}),
  construirExistentes: () => [],
  confirmarImportacao: vi.fn(async () => {}),
  dadosDaCarga: vi.fn(),
  dadosDaTransferencia: vi.fn(),
  pagamentoDaLinha: vi.fn(),
}));

let linhas: LinhaAnalisada[] | null = [];
const setLinhas = vi.fn();
const setTexto = vi.fn();

vi.mock("../stores/importacaoStore", () => ({
  useImportacaoStore: (s: (e: unknown) => unknown) =>
    s({ texto: "", setTexto, linhas, setLinhas, resetar: vi.fn() }),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
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
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Importar = (await import("./Importar")).default;

/** Constrói a linha com a própria `analisarLinha` em vez de a inventar à mão.
 *  Um stub literal deste tipo precisa de `classificacao` e `duplicata`
 *  aninhados, e quando falta um deles a página rebenta com "Cannot read
 *  properties of undefined" — que não diz qual campo é. Assim a forma não pode
 *  divergir do tipo real. */
const linha = (extra: Partial<LinhaExtrato> = {}): LinhaAnalisada =>
  analisarLinha(
    { data: "2026-08-03", descricao: "MERCADO CONTINENTE", valor: -4250, ...extra },
    1,
    {
      parcelas: [],
      categoriasConfiguradas: CONFIG_PADRAO.categoriasDespesa,
      despesasHistorico: [],
      receitasHistorico: [],
      locaisCarregamento: [],
      cargasHistorico: [],
      existentes: [],
    },
  );

beforeEach(() => {
  linhas = [];
  setLinhas.mockClear();
  extrairExtratoPdf.mockReset();
});

describe("Importar", () => {
  test("monta e mostra a área de colar o extrato", () => {
    render(<Importar />);
    expect(screen.getByRole("heading", { name: "Importar" })).toBeInTheDocument();
  });

  test("sem linhas analisadas: não mostra a lista de revisão", () => {
    render(<Importar />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  test("com linhas: aparecem os filtros e a linha do extrato", () => {
    linhas = [linha()];
    render(<Importar />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByDisplayValue("MERCADO CONTINENTE")).toBeInTheDocument();
  });

  test("os filtros são um tablist com painel — e o painel é a lista", () => {
    // Variante de painel único: os separadores apontam todos para a mesma
    // lista, que muda de rótulo conforme o filtro escolhido.
    linhas = [linha()];
    render(<Importar />);

    const todas = screen.getByRole("tab", { name: /Todas/ });
    const painel = screen.getByRole("tabpanel");
    expect(todas).toHaveAttribute("aria-controls", painel.id);
    expect(painel).toHaveAttribute("aria-labelledby", todas.id);
  });

  test("setas percorrem os filtros", async () => {
    linhas = [linha()];
    render(<Importar />);
    screen.getByRole("tab", { selected: true }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Auto-classificadas/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("filtrar por uma decisão sem linhas esvazia a lista", async () => {
    linhas = [linha()];
    render(<Importar />);

    await userEvent.click(screen.getByRole("tab", { name: /Prováveis duplicatas/ }));
    expect(screen.queryByDisplayValue("MERCADO CONTINENTE")).not.toBeInTheDocument();
  });

  test("aria-busy fica true enquanto lê o PDF — achado da auditoria de Acessibilidade: o toast some sozinho antes de PDFs grandes terminarem", async () => {
    linhas = null;
    let resolver: (v: unknown[]) => void = () => {};
    extrairExtratoPdf.mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );

    const { container } = render(<Importar />);
    const entrada = screen.getByText("Colar ou carregar extrato").parentElement!;
    expect(entrada).toHaveAttribute("aria-busy", "false");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const arquivo = new File(["conteudo"], "extrato.pdf", { type: "application/pdf" });
    await userEvent.upload(input, arquivo);

    await waitFor(() => expect(entrada).toHaveAttribute("aria-busy", "true"));

    resolver([]);
    await waitFor(() => expect(entrada).toHaveAttribute("aria-busy", "false"));
  });
});
