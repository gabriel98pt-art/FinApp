// @vitest-environment jsdom

// O gatilho do Toque Traseiro: um Atalho do iOS abre `?registro=despesa` e o
// app tem de abrir o registro rápido sozinho — sem isso a "automação" vira
// só um link que não faz nada, e sem limpar o parâmetro depois, um F5
// reabriria o registro pra sempre.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useAbrirRegistroPorUrl } from "./useAbrirRegistroPorUrl";

const abrirRegistro = vi.fn();

vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) => s({ abrirRegistro }),
}));

function Sonda() {
  useAbrirRegistroPorUrl();
  const [params] = useSearchParams();
  return <span data-testid="query">{params.toString()}</span>;
}

function renderComUrl(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Sonda />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  abrirRegistro.mockClear();
});

describe("useAbrirRegistroPorUrl", () => {
  test("?registro=despesa abre o registro rápido no tipo certo", () => {
    renderComUrl("/?registro=despesa");
    expect(abrirRegistro).toHaveBeenCalledWith("despesa");
  });

  test("?registro=receita abre no tipo receita, não no default", () => {
    renderComUrl("/?registro=receita");
    expect(abrirRegistro).toHaveBeenCalledWith("receita");
  });

  test("remove o parâmetro da URL depois de ler — um F5 não pode reabrir sozinho", () => {
    renderComUrl("/?registro=despesa");
    expect(screen.getByTestId("query")).toHaveTextContent("");
  });

  test("sem o parâmetro, não abre nada", () => {
    renderComUrl("/");
    expect(abrirRegistro).not.toHaveBeenCalled();
  });

  test("tipo desconhecido não abre o registro, mas ainda limpa a URL", () => {
    renderComUrl("/?registro=lixo");
    expect(abrirRegistro).not.toHaveBeenCalled();
    expect(screen.getByTestId("query")).toHaveTextContent("");
  });

  test("outros parâmetros da URL sobrevivem — só 'registro' é removido", () => {
    renderComUrl("/?registro=despesa&utm_source=atalho");
    expect(screen.getByTestId("query")).toHaveTextContent("utm_source=atalho");
  });
});
