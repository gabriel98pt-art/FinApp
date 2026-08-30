// @vitest-environment jsdom

// A folha que reúne a configuração do módulo Veículo. O que se testa aqui é o
// que se perdeu ao sair da página Veículo: que a escolha continua a existir,
// continua a mostrar o valor guardado e continua a gravar em cfg.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import type { ConfigConta } from "../../types";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
const atualizarConfig = vi.fn(async () => {});
const definirCorCategoria = vi.fn(async () => {});
const definirIconeCategoria = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({
  atualizarConfig: (...a: unknown[]) => atualizarConfig(...(a as [])),
  definirCorCategoria: (...a: unknown[]) => definirCorCategoria(...(a as [])),
  definirIconeCategoria: (...a: unknown[]) => definirIconeCategoria(...(a as [])),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const FolhaVeiculo = (await import("./FolhaVeiculo")).default;

function abrir(cfg: ConfigConta = CONFIG_PADRAO) {
  return render(<FolhaVeiculo cfg={cfg} uid="u1" aberta aoFechar={() => {}} />);
}

beforeEach(() => {
  atualizarConfig.mockClear();
  definirCorCategoria.mockClear();
  definirIconeCategoria.mockClear();
});

describe("FolhaVeiculo", () => {
  test("mostra a motorização guardada em cfg", () => {
    abrir({ ...CONFIG_PADRAO, tipoVeiculo: "hibrido" });
    expect(screen.getByRole("button", { name: /Tipo de veículo/ })).toHaveTextContent("Híbrido");
  });

  test("escolher outra motorização grava em cfg", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Tipo de veículo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Combustão" }));
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { tipoVeiculo: "combustao" });
  });

  // Ajuste F do lote de 30/08: despesa do veículo deixou de ter categoria —
  // no lugar, UM ícone só (e a mesma cor acima) valendo pra todas, exceto
  // carga/abastecimento (ícone fixo, item 7).
  test("a linha do ícone diz se está escolhido e abre o seletor", async () => {
    abrir({ ...CONFIG_PADRAO, categoriaIcone: { Veículo: "wrench" } });
    const linha = screen.getByRole("button", { name: /Ícone das despesas/ });
    expect(linha).toHaveTextContent("Escolhido");

    await userEvent.click(linha);
    expect(
      screen.getByRole("dialog", { name: "Ícone das despesas do veículo" }),
    ).toBeInTheDocument();
  });

  test('sem ícone escolhido a linha diz "Padrão"', () => {
    abrir();
    expect(screen.getByRole("button", { name: /Ícone das despesas/ })).toHaveTextContent("Padrão");
  });

  test("escolher um ícone grava em categoriaIcone['Veículo']", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Ícone das despesas/ }));
    await userEvent.click(screen.getByRole("button", { name: "wrench" }));

    expect(definirIconeCategoria).toHaveBeenCalledWith("u1", "Veículo", "wrench");
  });

  // A cor não é campo próprio: "Veículo" entra no mesmo `categoriaCor` das
  // categorias, e é a mesma entrada que a cor do botão flutuante já lia.
  // Mudou de sítio (estava solta em Aparência), não de mecanismo.
  test("a linha da cor diz se está personalizada e abre o seletor", async () => {
    abrir({ ...CONFIG_PADRAO, categoriaCor: { Veículo: "#ff0000" } });
    const linha = screen.getByRole("button", { name: /Cor do Veículo/ });
    expect(linha).toHaveTextContent("Personalizada");

    await userEvent.click(linha);
    expect(screen.getByRole("dialog", { name: "Cor do Veículo" })).toBeInTheDocument();
  });

  test('sem cor escolhida a linha diz "Padrão"', () => {
    abrir();
    expect(screen.getByRole("button", { name: /Cor do Veículo/ })).toHaveTextContent("Padrão");
  });
});

// O interruptor do módulo mora aqui dentro, e não solto em Definições ao lado
// do Módulo TVDE: é o sítio onde já vive tudo o que é do Veículo. Ao contrário
// do TVDE, nasce LIGADO — o módulo já existe há muito e há contas com dados lá
// dentro.
describe("FolhaVeiculo — interruptor do módulo", () => {
  test("nasce ligado", () => {
    abrir();
    expect(screen.getByRole("switch", { name: "Módulo Veículo" })).toBeChecked();
  });

  test("desligar grava showVeiculo: false", async () => {
    abrir();
    await userEvent.click(screen.getByRole("switch", { name: "Módulo Veículo" }));
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { showVeiculo: false });
  });

  test("voltar a ligar grava showVeiculo: true", async () => {
    abrir({ ...CONFIG_PADRAO, showVeiculo: false });
    await userEvent.click(screen.getByRole("switch", { name: "Módulo Veículo" }));
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { showVeiculo: true });
  });

  test("desligado, o resto da folha sai — só o interruptor fica", () => {
    abrir({ ...CONFIG_PADRAO, showVeiculo: false });
    expect(screen.getByRole("switch", { name: "Módulo Veículo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tipo de veículo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ícone das despesas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cor do Veículo/ })).not.toBeInTheDocument();
  });
});
