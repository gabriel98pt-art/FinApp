// @vitest-environment jsdom

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeletorOrdem from "./SeletorOrdem";
import type { Ordem } from "../utils/ordem";

function Caixa() {
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  return <SeletorOrdem valor={ordem} aoMudar={setOrdem} />;
}

describe("SeletorOrdem", () => {
  test("o gatilho diz a ordem atual e abre as quatro opções em radiogroup", async () => {
    render(<Caixa />);
    const gatilho = screen.getByRole("button", { name: "Ordenar por — atual: Mais recentes" });
    expect(gatilho).toHaveTextContent("Mais recentes");
    expect(gatilho).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(gatilho);
    expect(gatilho).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "Mais recentes" })).toBeChecked();
  });

  test("escolher uma ordem fecha a folha e passa a ser o texto do gatilho", async () => {
    render(<Caixa />);
    await userEvent.click(screen.getByRole("button", { name: /^Ordenar por/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "Maior valor" }));

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Ordenar por/ })).toHaveTextContent("Maior valor");
  });
});
