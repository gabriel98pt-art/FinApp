// @vitest-environment jsdom

// Item 2 do lote de UX/nav (30/08): o menu único de ações por item de lista.
// O que se protege aqui é o contrato que TODA tela vai depender: cada ação
// fecha o menu E dispara o `onClick` dela — nesta ordem, sempre.

import { useRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Check, Pencil, Trash2 } from "lucide-react";
import MenuAcoesItem, { type AcaoItem } from "./MenuAcoesItem";

function Wrapper({ acoes, aoFechar }: { acoes: AcaoItem[]; aoFechar: () => void }) {
  const ancoraRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ancoraRef}>Gatilho</button>
      <MenuAcoesItem
        aberta
        aoFechar={aoFechar}
        titulo="Ações"
        ancoraRef={ancoraRef}
        acoes={acoes}
      />
    </>
  );
}

describe("MenuAcoesItem", () => {
  test("mostra uma linha por ação, com o rótulo certo", () => {
    render(
      <Wrapper
        aoFechar={vi.fn()}
        acoes={[
          { rotulo: "Editar", Icone: Pencil, onClick: vi.fn() },
          { rotulo: "Marcar como pago", Icone: Check, onClick: vi.fn() },
          { rotulo: "Excluir", Icone: Trash2, onClick: vi.fn(), tone: "perigo" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como pago" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  test("clicar numa ação fecha o menu E dispara o onClick dela", () => {
    const aoFechar = vi.fn();
    const aoEditar = vi.fn();
    render(
      <Wrapper
        aoFechar={aoFechar}
        acoes={[
          { rotulo: "Editar", Icone: Pencil, onClick: aoEditar },
          { rotulo: "Excluir", Icone: Trash2, onClick: vi.fn(), tone: "perigo" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(aoEditar).toHaveBeenCalledTimes(1);
  });

  test("clicar numa ação não dispara o onClick de outra", () => {
    const aoExcluir = vi.fn();
    const aoEditar = vi.fn();
    render(
      <Wrapper
        aoFechar={vi.fn()}
        acoes={[
          { rotulo: "Editar", Icone: Pencil, onClick: aoEditar },
          { rotulo: "Excluir", Icone: Trash2, onClick: aoExcluir, tone: "perigo" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(aoExcluir).toHaveBeenCalledTimes(1);
    expect(aoEditar).not.toHaveBeenCalled();
  });
});
