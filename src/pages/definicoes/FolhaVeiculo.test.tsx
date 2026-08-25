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
const adicionarItemLista = vi.fn(async () => {});
const definirCorCategoria = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({
  atualizarConfig: (...a: unknown[]) => atualizarConfig(...(a as [])),
  adicionarItemLista: (...a: unknown[]) => adicionarItemLista(...(a as [])),
  removerItemLista: vi.fn(async () => {}),
  renomearCategoria: vi.fn(async () => {}),
  renomearFonte: vi.fn(async () => {}),
  definirCorCategoria: (...a: unknown[]) => definirCorCategoria(...(a as [])),
  definirIconeCategoria: vi.fn(async () => {}),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const FolhaVeiculo = (await import("./FolhaVeiculo")).default;

function abrir(cfg: ConfigConta = CONFIG_PADRAO) {
  return render(<FolhaVeiculo cfg={cfg} uid="u1" aberta aoFechar={() => {}} />);
}

beforeEach(() => {
  atualizarConfig.mockClear();
  adicionarItemLista.mockClear();
  definirCorCategoria.mockClear();
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

  // As categorias do veículo eram chips soltos na aba Despesas da página
  // Veículo, sem ícone nem cor. Passam pelo mesmo FolhaCategorias das
  // categorias gerais — o que se garante aqui é que a lista certa chega lá.
  test("a linha das categorias abre a lista do veículo, não a de despesa geral", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Categorias de despesa/ }));

    expect(screen.getByRole("dialog", { name: "Categorias do veículo" })).toBeInTheDocument();
    for (const nome of CONFIG_PADRAO.categoriasVeiculo) {
      expect(screen.getByText(nome)).toBeInTheDocument();
    }
  });

  test("adicionar uma categoria grava na lista do veículo", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: /Categorias de despesa/ }));
    await userEvent.type(screen.getByRole("textbox"), "Estacionamento");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(adicionarItemLista).toHaveBeenCalledWith(
      "u1",
      CONFIG_PADRAO,
      "categoriasVeiculo",
      "Estacionamento",
    );
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
