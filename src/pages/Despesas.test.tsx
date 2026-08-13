// @vitest-environment jsdom

// Smoke de Despesas + o teclado das abas.
//
// O teclado foi validado ao vivo no browser (dev-preview, Despesas/Veículo/
// TVDE: setas, volta nas pontas, Home/End, e o Tab a sair da lista inteira).
// Estes testes existem para isso não voltar a partir-se em silêncio — é
// comportamento que ninguém vê a não ser que navegue por teclado.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DespesaCorrente, DespesaFixa } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/lancamentosService", () => ({
  alternarPagoDespesaFixa: vi.fn(async () => {}),
  atualizarDespesaFixa: vi.fn(async () => {}),
  criarDespesaFixa: vi.fn(async () => {}),
  removerDespesaFixa: vi.fn(async () => {}),
}));

const lista = <T,>(itens: T[] = []) => ({ itens, carregado: true, erro: false });

let despesas = lista<DespesaCorrente>();
let fixas = lista<DespesaFixa>();

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(fixas),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) =>
    s({ dados: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] }, ...lista() }),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) => s({ abrirRegistro: vi.fn() }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Despesas = (await import("./Despesas")).default;

const fixa = (extra: Partial<DespesaFixa> = {}): DespesaFixa => ({
  id: "f1",
  descricao: "Netflix",
  valor: 1590,
  categoria: "Assinaturas",
  pagoPorMes: {},
  ...extra,
});

beforeEach(() => {
  despesas = lista<DespesaCorrente>();
  fixas = lista<DespesaFixa>();
});

describe("Despesas", () => {
  test("monta e abre na aba Correntes", () => {
    render(<Despesas />);
    expect(screen.getByRole("heading", { name: "Despesas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("sem despesas: estado vazio da aba Correntes", () => {
    render(<Despesas />);
    expect(screen.getByText(/Nenhuma despesa em agosto 2026/)).toBeInTheDocument();
  });

  test("aba Fixas sem nada mostra o vazio próprio, não o das correntes", async () => {
    render(<Despesas />);
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    expect(screen.getByText("Nenhuma despesa fixa ainda")).toBeInTheDocument();
  });

  test("fixa fora do mês diz que existe noutro mês, não que não existe", async () => {
    // A distinção que o passe de polimento introduziu: nunca ter criado
    // nenhuma é diferente de ter criadas que só não vigoram neste mês.
    fixas = lista([fixa({ inicio: "2026-11" })]);
    render(<Despesas />);
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    expect(screen.getByText(/Nenhuma despesa fixa em agosto 2026/)).toBeInTheDocument();
    expect(screen.getByText(/começam ou terminam em outros meses/)).toBeInTheDocument();
  });

  test("o selo da fixa diz de quem é e em que estado está", async () => {
    fixas = lista([fixa()]);
    render(<Despesas />);
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    // Sem nome próprio, uma lista de fixas dava vários botões "Pendente"
    // indistinguíveis — e sem aria-pressed nada dizia que alternam.
    const selo = screen.getByRole("button", { name: "Netflix — pendente" });
    expect(selo).toHaveAttribute("aria-pressed", "false");
  });
});

describe("teclado das abas", () => {
  /** Foca o separador activo, que é o único na ordem do Tab. */
  const focarAtivo = () => screen.getByRole("tab", { selected: true }).focus();

  test("só o separador activo está na ordem do Tab", () => {
    render(<Despesas />);

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("tabindex", "0");
    // O resto sai da ordem do Tab: é isso que faz o Tab entrar e sair do grupo
    // de uma vez, em vez de obrigar a passar por cima de cada separador.
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("tabindex", "-1");
  });

  test("seta para a direita avança e leva o foco consigo", async () => {
    render(<Despesas />);
    focarAtivo();
    await userEvent.keyboard("{ArrowRight}");

    const fixasTab = screen.getByRole("tab", { name: "Fixas" });
    expect(fixasTab).toHaveAttribute("aria-selected", "true");
    // O foco tem de ir junto, senão a seta seguinte parte de onde a pessoa já
    // não está.
    expect(fixasTab).toHaveFocus();
  });

  test("seta para a esquerda recua", async () => {
    render(<Despesas />);
    focarAtivo();
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("dá a volta nas duas pontas", async () => {
    render(<Despesas />);
    focarAtivo();

    // Da última para a primeira.
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");

    // E da primeira para a última.
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("aria-selected", "true");
  });

  test("cima e baixo funcionam como esquerda e direita", async () => {
    // Quem usa leitor de ecrã em modo de aplicação tenta as duas.
    render(<Despesas />);
    focarAtivo();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("Home e End saltam para as pontas", async () => {
    render(<Despesas />);
    focarAtivo();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("teclas que não são nossas passam adiante", async () => {
    // Travar tudo seria pior do que não fazer nada: a página tem de continuar
    // a responder ao resto do teclado com o foco num separador.
    render(<Despesas />);
    focarAtivo();
    await userEvent.keyboard("{PageDown}");

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("o separador aponta para o painel, e o painel de volta para ele", () => {
    render(<Despesas />);

    const aba = screen.getByRole("tab", { name: "Correntes" });
    const painel = screen.getByRole("tabpanel");
    // O par que faltava ao padrão ARIA: sem ele, um leitor de ecrã anuncia
    // "separador" sem ter região nenhuma associada para onde saltar.
    expect(aba).toHaveAttribute("aria-controls", painel.id);
    expect(painel).toHaveAttribute("aria-labelledby", aba.id);
  });
});

// ---------------------------------------------------------------------------
// Reembolso: a despesa negativa que reduz a categoria.
// ---------------------------------------------------------------------------

const gasto = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente =>
  ({
    id: "d1",
    descricao: "Jantar de equipa",
    valor: 10000,
    data: "2026-08-03",
    categoria: "Restaurante",
    ...extra,
  }) as DespesaCorrente;

const devolvido = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente =>
  gasto({
    id: "r1",
    descricao: "Reembolso jantar",
    valor: -7500,
    data: "2026-08-05",
    origem: "reemb",
    reembolsoDeId: "d1",
    ...extra,
  });

describe("Despesas com reembolso", () => {
  test("o reembolso aparece com + e em valor absoluto, não '− -75,00'", async () => {
    // A lista de despesas é tom="vermelho" e punha "−" em tudo. Com o valor já
    // negativo, saía o sinal duas vezes e o número ficava ilegível.
    despesas = lista([gasto(), devolvido()]);
    render(<Despesas />);

    const linha = screen.getByText("Reembolso jantar").closest("button")!;
    expect(linha.textContent).toContain("+");
    expect(linha.textContent).not.toContain("-75");
    expect(linha.textContent).not.toContain("−75");
  });

  test("a despesa comum continua com − e a vermelho", () => {
    despesas = lista([gasto()]);
    render(<Despesas />);

    const linha = screen.getByText("Jantar de equipa").closest("button")!;
    expect(linha.textContent).toContain("−");
  });

  test("a linha da despesa original mostra a conta do líquido", async () => {
    despesas = lista([gasto(), devolvido()]);
    render(<Despesas />);

    // "100,00 − 75,00 reembolsado = 25,00 líquido"
    expect(screen.getByText(/reembolsado/)).toBeInTheDocument();
    expect(screen.getByText(/líquido/)).toBeInTheDocument();
  });

  test("despesa sem reembolso não ganha linha nenhuma a mais", () => {
    despesas = lista([gasto()]);
    render(<Despesas />);
    expect(screen.queryByText(/reembolsado/)).not.toBeInTheDocument();
  });

  test("o total do mês já vem líquido", () => {
    // 100,00 − 75,00 = 25,00. Sem netar, o rodapé contradizia o donut.
    despesas = lista([gasto(), devolvido()]);
    render(<Despesas />);

    const rodape = screen.getByText("Total agosto 2026").closest("div")!;
    expect(rodape.textContent).toContain("25,00");
  });
});
