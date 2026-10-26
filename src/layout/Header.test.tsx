// @vitest-environment jsdom

// O olho do cabeçalho ocupa o lugar do botão de tema e mexe no mesmo campo que
// o interruptor "Modo discreto" de Definições.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

const desenhar = () =>
  render(
    <MemoryRouter>
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
});
