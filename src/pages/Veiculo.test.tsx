// @vitest-environment jsdom

// Veículo tem cinco abas, cada uma com a sua lista, e foi onde os quatro
// estados vazios passaram de <p> solto para o EstadoVazio do sistema. É
// também a página com mais abas, portanto a melhor para segurar o teclado
// delas com um número de separadores que não seja dois.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { DadosVeiculo, DespesaFixa } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/veiculoService", () => ({
  alternarPagoFixaVeiculo: vi.fn(async () => {}),
  atualizarCarga: vi.fn(async () => {}),
  atualizarDespesaVeiculo: vi.fn(async () => {}),
  atualizarFixaVeiculo: vi.fn(async () => {}),
  atualizarKm: vi.fn(async () => {}),
  criarCarga: vi.fn(async () => {}),
  criarDespesaVeiculo: vi.fn(async () => {}),
  criarFixaVeiculo: vi.fn(async () => {}),
  criarKm: vi.fn(async () => {}),
  removerCarga: vi.fn(async () => {}),
  removerDespesaVeiculo: vi.fn(async () => {}),
  removerFixaVeiculo: vi.fn(async () => {}),
  removerKm: vi.fn(async () => {}),
  VEICULO_VAZIO: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
}));
const atualizarConfig = vi.fn(async () => {});
vi.mock("../services/cfgService", () => ({
  adicionarItemLista: vi.fn(async () => {}),
  removerItemLista: vi.fn(async () => {}),
  renomearCategoria: vi.fn(async () => {}),
  renomearLocal: vi.fn(async () => {}),
  atualizarConfig: (...a: unknown[]) => atualizarConfig(...(a as [])),
}));

const vazio = (): DadosVeiculo =>
  ({ cargas: [], despesas: [], despesasFixas: [], quilometragem: [] }) as unknown as DadosVeiculo;

let dados = vazio();
let erro = false;

vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s({ dados, carregado: true, erro }),
}));
let cfg = CONFIG_PADRAO;
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Veiculo = (await import("./Veiculo")).default;

// Veiculo usa `useLocation` (item 4.6, aba pedida por Transações) — precisa
// de um Router em volta, mesmo nos testes que não navegam.
function renderVeiculo() {
  return render(
    <MemoryRouter>
      <Veiculo />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  dados = vazio();
  erro = false;
  cfg = CONFIG_PADRAO;
  atualizarConfig.mockClear();
});

describe("Veiculo", () => {
  test("monta e abre no Resumo", () => {
    renderVeiculo();
    expect(screen.getByRole("heading", { name: "Veículo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
  });

  test("tem as cinco abas", () => {
    renderVeiculo();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  test("cada aba vazia mostra o EstadoVazio dela, com o seu próprio texto", async () => {
    renderVeiculo();

    await userEvent.click(screen.getByRole("tab", { name: "Abastecimentos" }));
    expect(screen.getByText(/Nenhum abastecimento em agosto 2026/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Despesas" }));
    expect(screen.getByText(/Nenhuma despesa do veículo em agosto 2026/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Km" }));
    expect(screen.getByText(/Nenhum registo de km em agosto 2026/)).toBeInTheDocument();
  });

  test("o selo da fixa do veículo diz de quem é e em que estado está", async () => {
    dados = {
      ...vazio(),
      despesasFixas: [
        {
          id: "fv1",
          descricao: "Seguro",
          valor: 4500,
          categoria: "Seguro",
          pagoPorMes: {},
        } as DespesaFixa,
      ],
    } as unknown as DadosVeiculo;
    renderVeiculo();
    await userEvent.click(screen.getByRole("tab", { name: "Fixas" }));

    const selo = screen.getByRole("button", { name: "Seguro — pendente" });
    expect(selo).toHaveAttribute("aria-pressed", "false");
  });

  test("sincronização caída: faixa compacta acima das abas", () => {
    // Aqui o aviso fica compacto mesmo sem dados, ao contrário da regra geral:
    // as cinco abas vêm da mesma store e a caixa cheia repetida por aba seria
    // pior. O comentário no código explica; este teste segura a decisão.
    erro = true;
    renderVeiculo();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("setas percorrem as cinco abas e dão a volta", async () => {
    renderVeiculo();
    screen.getByRole("tab", { selected: true }).focus();

    await userEvent.keyboard("{ArrowLeft}");
    // Da primeira para trás = última.
    expect(screen.getByRole("tab", { name: "Km" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
  });
});

// Item B1: elétrico/combustão/híbrido escolhido na própria aba Abastecimentos.
describe("tipo de veículo (item B1)", () => {
  // A escolha mudou-se para Definições › Veículo (FolhaVeiculo). Aqui a página
  // só REFLETE o que estiver escolhido — e não pode voltar a oferecer o
  // controlo, senão volta a haver dois sítios a editar o mesmo campo.
  test("mostra a motorização em leitura, sem controlo para a editar", async () => {
    renderVeiculo();
    await userEvent.click(screen.getByRole("tab", { name: "Abastecimentos" }));

    expect(screen.getByText(/Veículo elétrico/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Tipo de veículo" })).not.toBeInTheDocument();
    expect(atualizarConfig).not.toHaveBeenCalled();
  });

  test("combustão: a lista mostra litros, não kWh", async () => {
    cfg = { ...CONFIG_PADRAO, tipoVeiculo: "combustao" };
    dados = {
      cargas: [
        { id: "c1", data: "2026-08-05", litros: 42, precoLitro: 165, custo: 6930, local: "Galp" },
      ],
      despesas: [],
      despesasFixas: [],
      quilometragem: [],
    } as unknown as DadosVeiculo;
    renderVeiculo();
    await userEvent.click(screen.getByRole("tab", { name: "Abastecimentos" }));

    expect(screen.getByText(/42 L/)).toBeInTheDocument();
    expect(screen.queryByText(/kWh/)).not.toBeInTheDocument();
  });
});
