// @vitest-environment jsdom

// Primeiro teste de renderização do app. O que estes testes apanham é o que
// nem o tsc nem o eslint apanham: a página monta? os três estados
// (carregando, vazio, com dados) mostram o que devem? o botão chama o que diz
// que chama?
//
// Receitas é a mais simples das catorze — delega tudo ao ListaLancamentos —,
// por isso é a que serve para provar o arranjo antes de o repetir.

import { describe, expect, test, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { KPIS_POR_PAGINA } from "../constants/kpis";

// Firebase nunca é tocado: as páginas leem das stores, e é nelas que mandamos.
vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const removerReceita = vi.fn(async () => {});
vi.mock("../services/lancamentosService", () => ({
  removerReceita: (...a: unknown[]) => removerReceita(...(a as [])),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) => seletor({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const abrirRegistro = vi.fn();

vi.mock("../stores/uiStore", () => ({
  useUiStore: (seletor: (s: unknown) => unknown) => seletor({ abrirRegistro }),
}));

let estadoReceitas = { itens: [] as Receita[], carregado: true, erro: false };
vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (seletor: (s: unknown) => unknown) => seletor(estadoReceitas),
}));

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (seletor: (s: unknown) => unknown) =>
    seletor({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));

vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (seletor: (s: unknown) => unknown) => seletor({ mes: "2026-08" }),
}));

const Receitas = (await import("./Receitas")).default;

const receita = (extra: Partial<Receita> = {}): Receita => ({
  id: "r1",
  descricao: "Salário",
  valor: 185000,
  data: "2026-08-05",
  fonte: "Trabalho",
  ...extra,
});

beforeEach(() => {
  estadoReceitas = { itens: [], carregado: true, erro: false };
  abrirRegistro.mockClear();
});

describe("Receitas", () => {
  test("monta e mostra o título da página", () => {
    render(<Receitas />);
    expect(screen.getByRole("heading", { name: "Receitas" })).toBeInTheDocument();
  });

  test("ainda a carregar: não afirma que não há nada", () => {
    // A distinção que interessa — "ainda não sabemos" não pode aparecer como
    // "não tens receitas". É a mesma confusão que o passe de Transações
    // corrigiu, agora protegida por teste.
    estadoReceitas = { itens: [], carregado: false, erro: false };
    render(<Receitas />);

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma receita/)).not.toBeInTheDocument();
  });

  test("carregado e sem nada: mostra o estado vazio", () => {
    render(<Receitas />);
    expect(screen.getByText(/Nenhuma receita em agosto 2026/)).toBeInTheDocument();
  });

  test("sincronização caída e sem dados: avisa em vez de dizer que está vazio", () => {
    estadoReceitas = { itens: [], carregado: true, erro: true };
    render(<Receitas />);

    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma receita/)).not.toBeInTheDocument();
  });

  test("sincronização caída COM dados: mostra as linhas e avisa por cima", () => {
    estadoReceitas = { itens: [receita()], carregado: true, erro: true };
    render(<Receitas />);

    // As linhas continuam válidas — o que caiu foi a actualização.
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("com dados: mostra a linha e o total do mês", () => {
    estadoReceitas = {
      itens: [receita(), receita({ id: "r2", descricao: "Extra", valor: 15000 })],
      carregado: true,
      erro: false,
    };
    render(<Receitas />);

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Extra")).toBeInTheDocument();
    expect(screen.getByText("Total agosto 2026")).toBeInTheDocument();
  });

  test("Adicionar abre o registo rápido no modo receita", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("button", { name: /Adicionar/ }));

    expect(abrirRegistro).toHaveBeenCalledWith("receita");
  });

  // Item 2 do lote de UX/nav (30/08): a linha inteira abre o menu único de
  // ações — Editar deixou de ser um toque direto, é uma das opções dele.
  test("clicar numa linha abre o menu de ações; Editar abre a edição daquela receita", async () => {
    estadoReceitas = { itens: [receita()], carregado: true, erro: false };
    render(<Receitas />);

    await userEvent.click(screen.getByText("Salário"));
    const editar = await screen.findByRole("button", { name: "Editar" });
    await userEvent.click(editar);

    // Com o id: abrir a edição da linha errada é o tipo de troca que passa
    // despercebida até alguém editar o lançamento errado.
    expect(abrirRegistro).toHaveBeenCalledWith("receita", "r1");
  });

  test("Excluir no menu de ações pede confirmação e remove a receita", async () => {
    estadoReceitas = { itens: [receita()], carregado: true, erro: false };
    render(<Receitas />);

    await userEvent.click(screen.getByText("Salário"));
    const excluir = await screen.findByRole("button", { name: "Excluir" });
    await userEvent.click(excluir);

    await waitFor(() => expect(removerReceita).toHaveBeenCalledWith("u1", "r1"));
  });
});

describe("KPIs de Receitas", () => {
  test("os quatro cartões, com os rótulos que Definições espera", () => {
    // A escolha de "KPIs no mobile" é casada por TEXTO (ver constants/kpis.ts e
    // o `Kpis` em components/Pagina.tsx). Quando os dois lados divergem nada
    // rebenta — a página cai calada nos dois primeiros cartões —, e é por isso
    // que tem de haver um teste a segurá-los juntos.
    estadoReceitas = { itens: [receita()], carregado: true, erro: false };
    render(<Receitas />);

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "receitas")!.rotulos;
    expect(esperados).toHaveLength(4);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  test("Maior fonte: de onde veio o maior pedaço do mês, em dinheiro", () => {
    // Substituiu "Lançamentos (mês)", que só contava as linhas da lista logo
    // abaixo — o número já estava à vista e não dizia nada de novo.
    estadoReceitas = {
      itens: [
        receita({ id: "r1", valor: 150000, fonte: "Trabalho" }),
        receita({ id: "r2", descricao: "Corridas", valor: 30000, fonte: "Uber" }),
        receita({ id: "r3", descricao: "Corridas", valor: 20000, fonte: "Uber" }),
      ],
      carregado: true,
      erro: false,
    };
    render(<Receitas />);

    expect(screen.getByText("€ 1.500,00")).toBeInTheDocument();
    // As duas linhas da Uber somam-se numa fonte só, com o peso dela no mês.
    expect(screen.getByText("Trabalho · 75% do mês")).toBeInTheDocument();
  });

  test("mês sem receitas: o cartão assume que não sabe, em vez de mostrar 0", () => {
    render(<Receitas />);
    expect(screen.getByText("sem receitas no mês")).toBeInTheDocument();
  });

  test("vs mês passado: a variação contra o mês anterior", () => {
    estadoReceitas = {
      itens: [
        receita({ id: "r0", valor: 100000, data: "2026-07-05" }),
        receita({ id: "r1", valor: 125000, data: "2026-08-05" }),
      ],
      carregado: true,
      erro: false,
    };
    render(<Receitas />);

    expect(screen.getByText("+25%")).toBeInTheDocument();
    expect(screen.getByText(/julho 2026: € 1\.000,00/)).toBeInTheDocument();
  });

  test("primeiro mês de uso: 'Novo' em vez de uma percentagem impossível", () => {
    // Nada em julho — a divisão seria por zero. O cartão continua lá.
    estadoReceitas = { itens: [receita({ valor: 125000 })], carregado: true, erro: false };
    render(<Receitas />);

    expect(screen.getByText("Novo")).toBeInTheDocument();
  });

  test("Média (3 meses): diz quando teve menos história do que promete", () => {
    // Só julho antes de agosto: a média é de UM mês, e o cartão assume-o em vez
    // de deixar ler "média de 3 meses" sobre um número que não é isso.
    estadoReceitas = {
      itens: [receita({ id: "r0", valor: 90000, data: "2026-07-05" })],
      carregado: true,
      erro: false,
    };
    render(<Receitas />);

    expect(screen.getByText("€ 900,00")).toBeInTheDocument();
    expect(screen.getByText("só 1 mês de história")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Ordenação e visão Mês/Semana (01/09/2026) — o mesmo par que Despesas
// correntes já tinha. O que estes testes seguram não é o comparador (isso é de
// utils/ordem.ts e utils/semanas.ts, testados à parte), é a LIGAÇÃO: que a
// escolha feita nos botões chega mesmo à lista desenhada.

/** Texto de cada linha da lista, na ordem em que estão desenhadas — é a ordem
 *  visível que interessa, não a do array intermédio. */
const linhasDaLista = () => screen.getAllByRole("listitem").map((li) => li.textContent ?? "");

/** Três receitas do mesmo mês, em semanas diferentes, com valores que NÃO
 *  acompanham as datas — sem isso "mais recente" e "maior valor" dariam a
 *  mesma ordem e o teste passaria mesmo com o comparador trocado. */
const tresReceitas = (): Receita[] => [
  receita({ id: "r1", descricao: "Salário", valor: 185000, data: "2026-08-05" }),
  receita({ id: "r2", descricao: "Bónus", valor: 50000, data: "2026-08-20" }),
  receita({ id: "r3", descricao: "Aluguel", valor: 12000, data: "2026-08-28" }),
];

describe("Receitas — ordenação da lista", () => {
  beforeEach(() => {
    estadoReceitas = { itens: tresReceitas(), carregado: true, erro: false };
  });

  test("por padrão vem da mais recente para a mais antiga", () => {
    render(<Receitas />);

    const [a, b, c] = linhasDaLista();
    expect(a).toContain("Aluguel");
    expect(b).toContain("Bónus");
    expect(c).toContain("Salário");
  });

  test("Mais antigas inverte a lista", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Mais antigas" }));

    const [a, b, c] = linhasDaLista();
    expect(a).toContain("Salário");
    expect(b).toContain("Bónus");
    expect(c).toContain("Aluguel");
  });

  test("Maior valor ordena pelo dinheiro, não pela data", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Maior valor" }));

    const [a, b, c] = linhasDaLista();
    expect(a).toContain("Salário");
    expect(b).toContain("Bónus");
    expect(c).toContain("Aluguel");
  });

  test("Menor valor ordena do mais barato para o mais caro", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Menor valor" }));

    const [a, b, c] = linhasDaLista();
    expect(a).toContain("Aluguel");
    expect(b).toContain("Bónus");
    expect(c).toContain("Salário");
  });

  test("mudar a ordem não muda o total do rodapé", async () => {
    render(<Receitas />);
    expect(screen.getByText("Total agosto 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Menor valor" }));

    // 1850 + 500 + 120 — a ordem mexe nas linhas, nunca na soma.
    expect(screen.getByText("Total agosto 2026")).toBeInTheDocument();
    expect(screen.getAllByText("€ 2.470,00").length).toBeGreaterThan(0);
  });
});

describe("Receitas — visão Mês / Semana", () => {
  beforeEach(() => {
    estadoReceitas = { itens: tresReceitas(), carregado: true, erro: false };
    // Sem relógio fixo a semana que abre por omissão muda conforme o dia em
    // que os testes correm, e o ficheiro passa a falhar sozinho amanhã.
    // 18/08/2026 é uma terça — a semana de 17/08 a 23/08, com a config padrão
    // (semana a começar à segunda).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("por padrão abre no mês inteiro", () => {
    render(<Receitas />);

    expect(screen.getByRole("radio", { name: "Mês" })).toHaveAttribute("aria-checked", "true");
    expect(linhasDaLista()).toHaveLength(3);
  });

  test("Semana filtra a lista para a semana de hoje", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));

    // Só o "Bónus" (20/08) cai entre 17/08 e 23/08.
    const linhas = linhasDaLista();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain("Bónus");
    expect(screen.getByText("Total 17/08 – 23/08")).toBeInTheDocument();
  });

  test("com Semana escolhida, o primeiro KPI passa a falar da semana", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));

    expect(screen.getByText("Total da semana")).toBeInTheDocument();
    expect(screen.queryByText("Total do mês")).not.toBeInTheDocument();
    // € 500,00 aparece no cartão e no rodapé da lista — os dois falam agora
    // do mesmo período, que é justamente o ponto.
    expect(screen.getAllByText("€ 500,00").length).toBe(2);
  });

  test("as setas andam de semana, e uma semana vazia diz que está vazia", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));
    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    // 10/08 – 16/08 não tem nenhuma das três receitas.
    expect(screen.getByText("Nenhuma receita em 10/08 – 16/08")).toBeInTheDocument();
  });

  test("voltar a Mês devolve a lista inteira", async () => {
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));
    await userEvent.click(screen.getByRole("radio", { name: "Mês" }));

    expect(linhasDaLista()).toHaveLength(3);
    expect(screen.getByText("Total agosto 2026")).toBeInTheDocument();
  });

  test("a ordenação continua a valer dentro da visão por semana", async () => {
    estadoReceitas = {
      itens: [
        receita({ id: "r1", descricao: "Salário", valor: 185000, data: "2026-08-18" }),
        receita({ id: "r2", descricao: "Bónus", valor: 50000, data: "2026-08-20" }),
        receita({ id: "r3", descricao: "Aluguel", valor: 12000, data: "2026-08-28" }),
      ],
      carregado: true,
      erro: false,
    };
    render(<Receitas />);
    await userEvent.click(screen.getByRole("radio", { name: "Semana" }));
    await userEvent.click(screen.getByRole("radio", { name: "Menor valor" }));

    // Só as duas da semana, e essas duas ordenadas pelo valor.
    const linhas = linhasDaLista();
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("Bónus");
    expect(linhas[1]).toContain("Salário");
  });
});
