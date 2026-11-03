// @vitest-environment jsdom

// O olho do cabeçalho ocupa o lugar do botão de tema e mexe no mesmo campo que
// o interruptor "Modo discreto" de Definições.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";

let cfg: ConfigConta = CONFIG_PADRAO;
const atualizarConfig = vi.fn(async () => {});

vi.mock("../services/cfgService", () => ({ atualizarConfig }));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../components/NotificacoesSino", () => ({ default: () => <span /> }));

const Header = (await import("./Header")).default;

const desenhar = (rota = "/") =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Header />
    </MemoryRouter>,
  );

beforeEach(() => {
  cfg = CONFIG_PADRAO;
  atualizarConfig.mockClear();
});

describe("Header", () => {
  test("não tem mais o botão de tema", () => {
    desenhar();
    expect(screen.queryByRole("button", { name: /tema/i })).not.toBeInTheDocument();
  });

  test("o olho liga o modo discreto", () => {
    desenhar();
    const olho = screen.getByRole("button", { name: "Ocultar valores" });
    expect(olho).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(olho);
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { modoDiscreto: true });
  });

  test("com o modo discreto ligado o olho mostra os valores de volta", () => {
    cfg = { ...CONFIG_PADRAO, modoDiscreto: true };
    desenhar();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar valores" }));
    expect(atualizarConfig).toHaveBeenCalledWith("u1", { modoDiscreto: false });
  });

  test("sem seletor de mês, o título pequeno aparece no centro ao rolar", () => {
    desenhar("/definicoes");
    const titulo = screen.getByText("Definições");
    expect(titulo.className).not.toMatch(/tituloVisivel/);
    act(() => {
      window.scrollY = 100;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(titulo.className).toMatch(/tituloVisivel/);
    act(() => {
      window.scrollY = 0;
      window.dispatchEvent(new Event("scroll"));
    });
  });

  test("com seletor de mês, o centro é sempre o mês", () => {
    desenhar("/despesas");
    expect(screen.queryByText("Despesas")).not.toBeInTheDocument();
  });
});
