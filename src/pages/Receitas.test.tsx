// @vitest-environment jsdom

// Primeiro teste de renderização do app. O que estes testes apanham é o que
// nem o tsc nem o eslint apanham: a página monta? os três estados
// (carregando, vazio, com dados) mostram o que devem? o botão chama o que diz
// que chama?
//
// Receitas é a mais simples das catorze — delega tudo ao ListaLancamentos —,
// por isso é a que serve para provar o arranjo antes de o repetir.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { KPIS_POR_PAGINA } from "../constants/kpis";

// Firebase nunca é tocado: as páginas leem das stores, e é nelas que mandamos.
vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

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

  test("clicar numa linha abre a edição daquela receita", async () => {
    estadoReceitas = { itens: [receita()], carregado: true, erro: false };
    render(<Receitas />);

    await userEvent.click(screen.getByText("Salário"));
    // Com o id: abrir a edição da linha errada é o tipo de troca que passa
    // despercebida até alguém editar o lançamento errado.
    expect(abrirRegistro).toHaveBeenCalledWith("receita", "r1");
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
