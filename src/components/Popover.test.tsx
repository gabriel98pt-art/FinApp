// @vitest-environment jsdom

// Achado da auditoria de Acessibilidade: `role="dialog"` sem gestão de foco
// nenhuma — o foco nunca entrava na caixa ao abrir, nem voltava ao gatilho
// ao fechar. Afeta ~15 seletores inline no fluxo de Importar.

import { useRef, useState } from "react";
import { describe, expect, test } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Popover from "./Popover";

/** Gatilho real + Popover controlado, como qualquer consumidor de verdade
 *  (FolhaAncorada). O botão "Fora" simula outro elemento que pode ganhar
 *  foco por um motivo alheio ao Popover. */
function Cenario() {
  const ancoraRef = useRef<HTMLButtonElement>(null);
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button ref={ancoraRef} onClick={() => setAberta(true)}>
        Abrir
      </button>
      <button
        onClick={() => {
          document.getElementById("fora-do-popover")?.focus();
          setAberta(false);
        }}
      >
        Fechar e focar outra coisa
      </button>
      <input id="fora-do-popover" aria-label="Outro campo" />
      <Popover
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Escolher"
        ancoraRef={ancoraRef}
      >
        <button>Opção A</button>
      </Popover>
    </>
  );
}

describe("Popover — gestão de foco", () => {
  test("abrir move o foco pra dentro da caixa", async () => {
    render(<Cenario />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });

  test("fechar com Esc devolve o foco ao gatilho", async () => {
    render(<Cenario />);
    const gatilho = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(gatilho);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  test("se o fecho já focou outra coisa, o Popover não rouba o foco de volta", async () => {
    render(<Cenario />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Fechar e focar outra coisa" }));

    await waitFor(() => expect(screen.getByLabelText("Outro campo")).toHaveFocus());
  });

  test("abrir de novo depois de fechar volta a focar a caixa (não fica preso no 'já focou')", async () => {
    render(<Cenario />);
    const gatilho = screen.getByRole("button", { name: "Abrir" });

    fireEvent.click(gatilho);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(gatilho).toHaveFocus());

    fireEvent.click(gatilho);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });
});
