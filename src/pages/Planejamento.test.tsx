// @vitest-environment jsdom

// Planejamento é uma tela fina: o conteúdo todo é o OrcamentoCard. O que se
// testa aqui é portanto o cartão — sobretudo as linhas de categoria, que são
// botões e que este trabalho reescreveu para deixarem de ter <div> lá dentro.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DespesaCorrente } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/cfgService", () => ({ definirOrcamento: vi.fn(async () => {}) }));

let despesas = lista<DespesaCorrente>();
let cfg = { ...CONFIG_PADRAO };

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));

const Planejamento = (await import("./Planejamento")).default;

const despesa = (valor: number, categoria = "Alimentação"): DespesaCorrente =>
  ({
    id: `d${valor}`,
    descricao: "Mercado",
    valor,
    data: "2026-08-03",
    categoria,
  }) as DespesaCorrente;

beforeEach(() => {
  despesas = lista<DespesaCorrente>();
  cfg = { ...CONFIG_PADRAO };
});

describe("Planejamento", () => {
  test("monta e mostra o título", () => {
    render(<Planejamento />);
    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
  });

  test("sem tectos definidos: convida a definir o primeiro", () => {
    render(<Planejamento />);
    expect(screen.getByText(/Defina um teto mensal por categoria/)).toBeInTheDocument();
  });

  test("com teto: mostra a categoria, a percentagem gasta e é clicável", () => {
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 40000 } };
    despesas = lista([despesa(10000)]);
    render(<Planejamento />);

    const linha = screen.getByRole("button", { name: /Alimentação/ });
    expect(linha).toBeInTheDocument();
    // A percentagem em texto: a barra ao lado é só o eco visual dela.
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("a linha do orçamento não tem <div> lá dentro", () => {
    // O conteúdo de um <button> é, por especificação, conteúdo de frase. Esta
    // linha tinha quatro <div>, o que é HTML inválido — e era drift, porque as
    // outras listas clicáveis do app já usavam <span>.
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 40000 } };
    despesas = lista([despesa(10000)]);
    render(<Planejamento />);

    const linha = screen.getByRole("button", { name: /Alimentação/ });
    expect(linha.querySelector("div")).toBeNull();
  });

  test("estouro do teto aparece como selo, não só como cor", () => {
    // A cor sozinha não chega a quem não a distingue.
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 10000 } };
    despesas = lista([despesa(15000)]);
    render(<Planejamento />);

    expect(screen.getByText("Estourou")).toBeInTheDocument();
  });
});
