// @vitest-environment jsdom

// Smoke de Despesas + o teclado das abas.
//
// O teclado foi validado ao vivo no browser (dev-preview, Despesas/Veículo/
// TVDE: setas, volta nas pontas, Home/End, e o Tab a sair da lista inteira).
// Estes testes existem para isso não voltar a partir-se em silêncio — é
// comportamento que ninguém vê a não ser que navegue por teclado.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { DespesaCorrente, DespesaFixa } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { KPIS_POR_PAGINA } from "../constants/kpis";

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

// Despesas usa `useLocation` (item 4.6, aba pedida por Transações) — precisa
// de um Router em volta, mesmo nos testes que não navegam.
function renderDespesas() {
  return render(
    <MemoryRouter>
      <Despesas />
    </MemoryRouter>,
  );
}

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
    renderDespesas();
    expect(screen.getByRole("heading", { name: "Despesas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("sem despesas: estado vazio da aba Correntes", () => {
    renderDespesas();
    expect(screen.getByText(/Nenhuma despesa em agosto 2026/)).toBeInTheDocument();
  });

  test("aba Fixas sem nada mostra o vazio próprio, não o das correntes", async () => {
    renderDespesas();
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    expect(screen.getByText("Nenhuma despesa fixa ainda")).toBeInTheDocument();
  });

  test("fixa fora do mês diz que existe noutro mês, não que não existe", async () => {
    // A distinção que o passe de polimento introduziu: nunca ter criado
    // nenhuma é diferente de ter criadas que só não vigoram neste mês.
    fixas = lista([fixa({ inicio: "2026-11" })]);
    renderDespesas();
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    expect(screen.getByText(/Nenhuma despesa fixa em agosto 2026/)).toBeInTheDocument();
    expect(screen.getByText(/começam ou terminam em outros meses/)).toBeInTheDocument();
  });

  test("o selo da fixa diz de quem é e em que estado está", async () => {
    fixas = lista([fixa()]);
    renderDespesas();
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
    renderDespesas();

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("tabindex", "0");
    // O resto sai da ordem do Tab: é isso que faz o Tab entrar e sair do grupo
    // de uma vez, em vez de obrigar a passar por cima de cada separador.
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("tabindex", "-1");
  });

  test("seta para a direita avança e leva o foco consigo", async () => {
    renderDespesas();
    focarAtivo();
    await userEvent.keyboard("{ArrowRight}");

    const fixasTab = screen.getByRole("tab", { name: "Fixas" });
    expect(fixasTab).toHaveAttribute("aria-selected", "true");
    // O foco tem de ir junto, senão a seta seguinte parte de onde a pessoa já
    // não está.
    expect(fixasTab).toHaveFocus();
  });

  test("seta para a esquerda recua", async () => {
    renderDespesas();
    focarAtivo();
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("dá a volta nas duas pontas", async () => {
    renderDespesas();
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
    renderDespesas();
    focarAtivo();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("Home e End saltam para as pontas", async () => {
    renderDespesas();
    focarAtivo();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Fixas" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("teclas que não são nossas passam adiante", async () => {
    // Travar tudo seria pior do que não fazer nada: a página tem de continuar
    // a responder ao resto do teclado com o foco num separador.
    renderDespesas();
    focarAtivo();
    await userEvent.keyboard("{PageDown}");

    expect(screen.getByRole("tab", { name: "Correntes" })).toHaveAttribute("aria-selected", "true");
  });

  test("o separador aponta para o painel, e o painel de volta para ele", () => {
    renderDespesas();

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
    renderDespesas();

    const linha = screen.getByText("Reembolso jantar").closest("button")!;
    expect(linha.textContent).toContain("+");
    expect(linha.textContent).not.toContain("-75");
    expect(linha.textContent).not.toContain("−75");
  });

  test("a despesa comum continua com − e a vermelho", () => {
    despesas = lista([gasto()]);
    renderDespesas();

    const linha = screen.getByText("Jantar de equipa").closest("button")!;
    expect(linha.textContent).toContain("−");
  });

  test("a linha da despesa original mostra a conta do líquido", async () => {
    despesas = lista([gasto(), devolvido()]);
    renderDespesas();

    // "100,00 − 75,00 reembolsado = 25,00 líquido"
    expect(screen.getByText(/reembolsado/)).toBeInTheDocument();
    expect(screen.getByText(/líquido/)).toBeInTheDocument();
  });

  test("despesa sem reembolso não ganha linha nenhuma a mais", () => {
    despesas = lista([gasto()]);
    renderDespesas();
    expect(screen.queryByText(/reembolsado/)).not.toBeInTheDocument();
  });

  test("o total do mês já vem líquido", () => {
    // 100,00 − 75,00 = 25,00. Sem netar, o rodapé contradizia o donut.
    despesas = lista([gasto(), devolvido()]);
    renderDespesas();

    const rodape = screen.getByText("Soma desta lista · agosto 2026").closest("div")!;
    expect(rodape.textContent).toContain("25,00");
  });
});

describe("KPIs de Despesas", () => {
  const despesa = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente =>
    ({
      id: "d1",
      descricao: "Mercado",
      valor: 50000,
      data: "2026-08-05",
      categoria: "Alimentação",
      ...extra,
    }) as DespesaCorrente;

  test("os quatro cartões, com os rótulos que Definições espera", () => {
    // Mesma amarra de Receitas: a escolha de "KPIs no mobile" casa por texto, e
    // divergir daqui não rebenta nada — só faz a página cair calada nos dois
    // primeiros cartões.
    despesas = lista([despesa()]);
    renderDespesas();

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "despesas")!.rotulos;
    expect(esperados).toHaveLength(4);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  test("Maior categoria mostra o dinheiro em cima e o nome por baixo", () => {
    // Alimentação = 500 + 400 = 900; nenhuma linha sozinha vale isso, então o
    // que se encontra é mesmo o cartão.
    despesas = lista([
      despesa({ id: "d1", valor: 50000 }),
      despesa({ id: "d2", valor: 40000 }),
      despesa({ id: "d3", valor: 35000, categoria: "Transporte" }),
    ]);
    renderDespesas();

    expect(screen.getByText("€ 900,00")).toBeInTheDocument();
  });

  test("vs mês passado: a variação contra o mês anterior", () => {
    despesas = lista([
      despesa({ id: "d0", valor: 100000, data: "2026-07-05" }),
      despesa({ id: "d1", valor: 125000 }),
    ]);
    renderDespesas();

    expect(screen.getByText("+25%")).toBeInTheDocument();
    expect(screen.getByText(/julho 2026: € 1\.000,00/)).toBeInTheDocument();
  });

  test("primeiro mês de uso: 'Novo' em vez de uma percentagem impossível", () => {
    despesas = lista([despesa({ valor: 125000 })]);
    renderDespesas();

    expect(screen.getByText("Novo")).toBeInTheDocument();
  });

  test("Média (3 meses): a referência estável contra a qual ler o mês de agora", () => {
    // Substituiu "Lançamentos (mês)", que só contava as linhas da lista logo
    // abaixo — o número já estava à vista e não dizia nada de novo.
    despesas = lista([
      despesa({ id: "d5", valor: 10000, data: "2026-05-10" }),
      despesa({ id: "d6", valor: 20000, data: "2026-06-10" }),
      despesa({ id: "d7", valor: 30000, data: "2026-07-10" }),
      despesa({ id: "d8", valor: 99900, data: "2026-08-10" }),
    ]);
    renderDespesas();

    // (100 + 200 + 300) / 3 = 200. O mês exibido fica de fora de propósito: a
    // meio do mês ele arrastaria para baixo a própria referência.
    expect(screen.getByText("€ 200,00")).toBeInTheDocument();
    expect(screen.getByText("os 3 meses antes deste")).toBeInTheDocument();
  });

  test("Média (3 meses): só conta os meses que já existiam", () => {
    // Quem começou em julho não gasta "um terço" — dividir por três fixo fazia
    // o cartão mentir para baixo justamente em quem tem pouco tempo de app.
    despesas = lista([despesa({ id: "d7", valor: 30000, data: "2026-07-10" })]);
    renderDespesas();

    expect(screen.getByText("só 1 mês de história")).toBeInTheDocument();
  });

  test("Média (3 meses): sem passado nenhum, o cartão diz que não sabe", () => {
    despesas = lista([despesa({ valor: 50000 })]);
    renderDespesas();

    expect(screen.getByText("sem meses anteriores")).toBeInTheDocument();
  });
});
