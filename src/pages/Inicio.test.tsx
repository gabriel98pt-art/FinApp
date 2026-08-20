// @vitest-environment jsdom

// Início não tem lista própria: só totais, somados a partir de cinco domínios.
// É por isso que o aviso de sincronização importa mais aqui do que noutras
// telas — um total incompleto é indistinguível de um total certo, e com a
// subscrição caída no arranque o número é "€ 0,00", que se lê como "não tens
// nada" em vez de "não conseguimos saber".

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DespesaCorrente, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();
let fixas = lista();
let veiculo = veiculoVazio();

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(fixas),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculo),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Inicio = (await import("./Inicio")).default;

const desenhar = () =>
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );

beforeEach(() => {
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  fixas = lista();
  veiculo = veiculoVazio();
});

describe("Inicio", () => {
  test("monta e mostra os KPIs principais", () => {
    desenhar();
    expect(screen.getByRole("heading", { name: "Início" })).toBeInTheDocument();
    // Por `role` e não por texto: "Receitas" e "Despesas" aparecem também no
    // rodapé do Resumo Anual. Estes dois KPIs são botões porque navegam para a
    // tela respectiva — e é isso que os distingue.
    expect(screen.getByRole("button", { name: /Receitas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Despesas/ })).toBeInTheDocument();
  });

  test("tudo sincronizado: nenhum aviso", () => {
    desenhar();
    expect(screen.queryByText(/não sincronizaram/)).not.toBeInTheDocument();
  });

  test("um domínio em erro já levanta o aviso", () => {
    receitas = listaComErro<Receita>();
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha do veículo, não só a dos lançamentos", () => {
    // São cinco domínios a alimentar os mesmos quatro números. Olhar só ao
    // primeiro deixava passar em claro uma falha nas parcelas ou no veículo.
    veiculo = { ...veiculoVazio(), erro: true };
    desenhar();
    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso é a faixa fina — os KPIs continuam na tela", () => {
    // Compacto e não a caixa cheia: os números continuam a valer, o que caiu
    // foi a actualização.
    receitas = listaComErro<Receita>();
    desenhar();

    expect(screen.getByText(/Alguns dados não sincronizaram/)).toBeInTheDocument();
    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
  });

  test("os quadros têm cabeçalho de verdade, para se poder saltar entre eles", () => {
    // Eram <p>: quem navega por cabeçalhos não conseguia saltar de um quadro
    // para o outro nesta página, que é a primeira que se abre.
    desenhar();
    // "Últimos 6 meses" e não "Resumo Anual": o mesmo quadro aparece em
    // Planejamento → Metas com uma janela de 12 meses, e os dois chamavam-se
    // igual somando períodos diferentes. O título diz agora a janela.
    expect(screen.getByRole("heading", { name: "Últimos 6 meses" })).toBeInTheDocument();
  });
});
