// @vitest-environment jsdom

// Item 1 do lote de UX/nav (30/08): o "+" deixou de abrir o Registro Rápido
// direto — agora abre este menu (Nova despesa / Nova receita / Veículo), e
// só a escolha de uma linha é que abre o formulário no tipo certo.

import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";

let cfg: ConfigConta = CONFIG_PADRAO;
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg }),
}));

const abrirRegistro = vi.fn();
const fecharMenuRegistro = vi.fn();
vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) =>
    s({ menuRegistroAberto: true, abrirRegistro, fecharMenuRegistro }),
}));

const MenuRegistroRapido = (await import("./MenuRegistroRapido")).default;

describe("MenuRegistroRapido", () => {
  test("com o módulo Veículo ligado (padrão): as três linhas aparecem", () => {
    cfg = CONFIG_PADRAO;
    render(<MenuRegistroRapido />);
    expect(screen.getByRole("button", { name: /Nova despesa/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova receita/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Veículo/ })).toBeInTheDocument();
  });

  test("com o módulo Veículo desligado: a linha some", () => {
    cfg = { ...CONFIG_PADRAO, showVeiculo: false };
    render(<MenuRegistroRapido />);
    expect(screen.queryByRole("button", { name: /Veículo/ })).not.toBeInTheDocument();
  });

  test("escolher 'Nova despesa' fecha o menu e abre o registro no tipo certo", () => {
    cfg = CONFIG_PADRAO;
    render(<MenuRegistroRapido />);
    fireEvent.click(screen.getByRole("button", { name: /Nova despesa/ }));
    expect(fecharMenuRegistro).toHaveBeenCalled();
    expect(abrirRegistro).toHaveBeenCalledWith("despesa");
  });

  test("escolher 'Veículo' abre o registro em 'carga' (abastecimento por omissão)", () => {
    cfg = CONFIG_PADRAO;
    render(<MenuRegistroRapido />);
    fireEvent.click(screen.getByRole("button", { name: /Veículo/ }));
    expect(abrirRegistro).toHaveBeenCalledWith("carga");
  });
});
