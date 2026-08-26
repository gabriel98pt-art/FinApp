// @vitest-environment jsdom

// A mensagem crua do erro passou a aparecer na própria tela de crash (achado
// do P0 de 26/08: um crash preso — recarregar não sai do mesmo erro — só se
// diagnostica com acesso ao dispositivo, e quem crashou às vezes nem consegue
// chegar a Definições → Erros recentes para copiar a pilha de lá).

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

vi.mock("../services/firebase", () => ({ db: {} }));
vi.mock("../stores/authStore", () => ({
  useAuthStore: { getState: () => ({ sessao: null }) },
}));
vi.mock("../services/erroService", () => ({ registrarErro: vi.fn(async () => {}) }));

function Bomba(): never {
  throw new Error("Cannot read properties of undefined (reading 'metodos')");
}

describe("ErrorBoundary", () => {
  test("sem erro: mostra os filhos normalmente", () => {
    render(
      <ErrorBoundary>
        <p>Conteúdo normal</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Conteúdo normal")).toBeInTheDocument();
  });

  test("com erro: mostra a mensagem crua na tela, não só 'Algo correu mal'", () => {
    // Silencia o console.error do próprio React/ErrorBoundary neste teste —
    // é esperado, o boundary existe exactamente para isto.
    const consoleErro = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Algo correu mal")).toBeInTheDocument();
    expect(
      screen.getByText("Cannot read properties of undefined (reading 'metodos')"),
    ).toBeInTheDocument();
    consoleErro.mockRestore();
  });
});
