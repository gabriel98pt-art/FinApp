// @vitest-environment jsdom

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRadiogroupTeclado } from "./useRadiogroupTeclado";

const OPCOES = ["a", "b", "c"] as const;

/** Radiogroup mínimo, no mesmo molde dos ~14 do app real: container com
 *  `role="radiogroup"`, filhos `role="radio"` com `aria-checked` e
 *  `onClick`. */
function Fixture() {
  const [valor, setValor] = useState<(typeof OPCOES)[number]>("a");
  const { ref, onKeyDown } = useRadiogroupTeclado<HTMLDivElement>();
  return (
    <div role="radiogroup" aria-label="Teste" ref={ref} onKeyDown={onKeyDown}>
      {OPCOES.map((o) => (
        <button key={o} role="radio" aria-checked={valor === o} onClick={() => setValor(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

describe("useRadiogroupTeclado", () => {
  test("só o rádio marcado entra na ordem do Tab (tabindex giratório)", () => {
    render(<Fixture />);
    const [a, b, c] = screen.getAllByRole("radio");
    expect(a).toHaveAttribute("tabindex", "0");
    expect(b).toHaveAttribute("tabindex", "-1");
    expect(c).toHaveAttribute("tabindex", "-1");
  });

  test("seta direita/baixo move E escolhe a próxima opção", () => {
    render(<Fixture />);
    const [a, b] = screen.getAllByRole("radio");
    a.focus();

    fireEvent.keyDown(a, { key: "ArrowRight" });

    expect(b).toHaveFocus();
    expect(b).toHaveAttribute("aria-checked", "true");
    expect(a).toHaveAttribute("aria-checked", "false");
  });

  test("seta esquerda/cima dá a volta do primeiro pro último", () => {
    render(<Fixture />);
    const [a, , c] = screen.getAllByRole("radio");
    a.focus();

    fireEvent.keyDown(a, { key: "ArrowLeft" });

    expect(c).toHaveFocus();
    expect(c).toHaveAttribute("aria-checked", "true");
  });

  test("seta direita no último dá a volta pro primeiro", () => {
    render(<Fixture />);
    const [a, , c] = screen.getAllByRole("radio");
    c.focus();

    fireEvent.keyDown(c, { key: "ArrowDown" });

    expect(a).toHaveFocus();
    expect(a).toHaveAttribute("aria-checked", "true");
  });

  test("Home vai pro primeiro, End vai pro último", () => {
    render(<Fixture />);
    const [a, , c] = screen.getAllByRole("radio");
    a.focus();

    fireEvent.keyDown(a, { key: "End" });
    expect(c).toHaveFocus();

    fireEvent.keyDown(c, { key: "Home" });
    expect(a).toHaveFocus();
  });

  test("o tabindex giratório acompanha a opção escolhida por CLIQUE, não só por seta", async () => {
    render(<Fixture />);
    const [a, b] = screen.getAllByRole("radio");

    fireEvent.click(b);

    // O MutationObserver reage ao aria-checked de forma assíncrona (é um
    // microtask, não corre dentro do próprio fireEvent).
    await waitFor(() => expect(b).toHaveAttribute("tabindex", "0"));
    expect(a).toHaveAttribute("tabindex", "-1");
  });

  test("outras teclas não fazem nada", () => {
    render(<Fixture />);
    const [a] = screen.getAllByRole("radio");
    a.focus();

    fireEvent.keyDown(a, { key: "Enter" });

    expect(a).toHaveFocus();
    expect(a).toHaveAttribute("aria-checked", "true");
  });
});
