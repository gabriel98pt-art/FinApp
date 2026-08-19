// @vitest-environment jsdom

// Metas tem duas peças: o cartão da meta do mês (atingida ou não) e a lista de
// fundos de poupança. O que interessa proteger é a mesma distinção de sempre —
// "ainda não sabemos" não pode aparecer como "não tens nada" — e o selo de
// meta atingida, que muda de cor e de texto conforme o saldo.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Fundo, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/fundosService", () => ({
  criarFundo: vi.fn(async () => {}),
  atualizarFundo: vi.fn(async () => {}),
  removerFundo: vi.fn(async () => {}),
}));

let fundos = lista<Fundo>();
let receitas = lista<Receita>();

vi.mock("../stores/fundosStore", () => ({
  useFundosStore: (s: (e: unknown) => unknown) => s(fundos),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
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
// Mutável: um teste precisa de um mês visível DIFERENTE do mês real para
// apanhar o cartão a rotular-se com o mês errado.
let mesVisivel = "2026-08";
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: mesVisivel }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Metas = (await import("./Metas")).default;

const fundo = (extra: Partial<Fundo> = {}): Fundo => ({
  id: "fu1",
  nome: "Viagem",
  atual: 50000,
  alvo: 200000,
  ...extra,
});

beforeEach(() => {
  fundos = lista<Fundo>();
  receitas = lista<Receita>();
  mesVisivel = "2026-08";
});

describe("Metas", () => {
  test("monta e mostra o título", () => {
    render(<Metas />);
    expect(screen.getByRole("heading", { name: "Metas" })).toBeInTheDocument();
  });

  test("sem fundos: estado vazio que ensina como criar o primeiro", () => {
    render(<Metas />);
    expect(screen.getByText("Nenhum fundo criado")).toBeInTheDocument();
  });

  test("sincronização caída e sem fundos: avisa em vez de dizer que está vazio", () => {
    fundos = listaComErro<Fundo>();
    render(<Metas />);

    expect(screen.queryByText("Nenhum fundo criado")).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("com fundos: mostra o nome e a faixa fina se a sincronização caiu", () => {
    fundos = listaComErro([fundo()]);
    render(<Metas />);

    expect(screen.getByText("Viagem")).toBeInTheDocument();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("o cartão da meta é rotulado com o mês que gerou os números", () => {
    // Bug: o título usava o mês REAL e os números o mês do seletor. Com julho
    // escolhido, lia-se "Meta — Agosto 2026" por cima do saldo de julho.
    mesVisivel = "2026-07";
    render(<Metas />);

    expect(screen.getByText("Meta — julho 2026")).toBeInTheDocument();
  });

  test("a percentagem do fundo aparece em texto, não só na barra", () => {
    // As barras aqui são divs sem role de progresso, de propósito: o número já
    // está escrito ao lado. Se deixasse de estar, a barra passava a ser a única
    // fonte da informação e ficava invisível para quem usa leitor de ecrã.
    fundos = lista([fundo()]);
    render(<Metas />);

    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
