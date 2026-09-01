// @vitest-environment jsdom

import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampoValorDestaque from "./CampoValorDestaque";

/** CampoMoeda é controlado: sem re-render a cada tecla, cada dígito parte
 *  sempre de `null` outra vez. Este wrapper reproduz o que qualquer tela do
 *  app já faz (estado local + `aoMudar`). */
function CampoComEstado({ aoMudar }: { aoMudar: (v: number | null) => void }) {
  const [valor, setValor] = useState<number | null>(null);
  return (
    <CampoValorDestaque
      valor={valor}
      aoMudar={(v) => {
        setValor(v);
        aoMudar(v);
      }}
    />
  );
}

describe("CampoValorDestaque", () => {
  test('rótulo "Quanto?" por omissão', () => {
    render(<CampoValorDestaque valor={null} aoMudar={() => {}} />);
    expect(screen.getByText("Quanto?")).toBeInTheDocument();
  });

  test("aceita um rótulo diferente", () => {
    render(<CampoValorDestaque rotulo="Preço por kWh (€)" valor={null} aoMudar={() => {}} />);
    expect(screen.getByText("Preço por kWh (€)")).toBeInTheDocument();
    expect(screen.queryByText("Quanto?")).not.toBeInTheDocument();
  });

  test("dígitos entram pela direita, como o CampoMoeda de sempre", async () => {
    const aoMudar = vi.fn();
    render(<CampoComEstado aoMudar={aoMudar} />);
    await userEvent.type(screen.getByRole("textbox"), "123");
    expect(aoMudar).toHaveBeenLastCalledWith(123);
  });

  test('tom "receita" pinta o número de verde', () => {
    render(<CampoValorDestaque valor={1000} aoMudar={() => {}} tom="receita" />);
    expect(screen.getByRole("textbox").className).toMatch(/receita/);
  });
});
