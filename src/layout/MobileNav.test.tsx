// @vitest-environment jsdom

// Achado da auditoria de Acessibilidade: o menu "Mais" fechado só recebia
// opacity:0 — os links continuavam alcançáveis por Tab em toda tela mobile
// do app, a plataforma principal dele. O que se protege aqui é o `inert`
// (mesmo padrão já usado em BottomSheet/ConfirmarAcao): presente quando
// fechado, ausente quando aberto.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";

let cfg: ConfigConta = CONFIG_PADRAO;
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg }),
}));
vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) =>
    s({ abrirRegistro: vi.fn(), abrirMenuRegistro: vi.fn() }),
}));

const MobileNav = (await import("./MobileNav")).default;

function desenhar() {
  return render(
    <MemoryRouter>
      <MobileNav />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cfg = CONFIG_PADRAO;
});

// O módulo Veículo desliga-se em Definições › Veículo. Ligado é o estado
// normal (nasce `true`, ao contrário do TVDE): quem já usa o app não pode ver
// a aba desaparecer só porque o interruptor passou a existir.
describe("MobileNav — módulo Veículo", () => {
  test("ligado (padrão): a aba Veículo está no menu Mais", () => {
    desenhar();
    expect(screen.getByRole("link", { name: /Veículo/ })).toBeInTheDocument();
  });

  test("desligado: a aba Veículo sai do menu Mais", () => {
    cfg = { ...CONFIG_PADRAO, showVeiculo: false };
    desenhar();
    expect(screen.queryByRole("link", { name: /Veículo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Transações/ })).toBeInTheDocument();
  });
});

describe("MobileNav — menu Mais", () => {
  test("fechado por omissão: o menu é inert", () => {
    desenhar();
    const menu = screen.getByRole("link", { name: /Transações/ }).closest("div")!;
    expect(menu).toHaveAttribute("inert");
  });

  test("abrir o menu tira o inert — os links voltam a ser alcançáveis", () => {
    desenhar();
    fireEvent.click(screen.getByRole("button", { name: "Mais abas" }));

    const menu = screen.getByRole("link", { name: /Transações/ }).closest("div")!;
    expect(menu).not.toHaveAttribute("inert");
  });

  test("fechar de novo (clique no véu) devolve o inert", () => {
    const { container } = desenhar();
    fireEvent.click(screen.getByRole("button", { name: "Mais abas" }));
    const veu = container.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(veu);

    const menu = screen.getByRole("link", { name: /Transações/ }).closest("div")!;
    expect(menu).toHaveAttribute("inert");
  });
});
