// @vitest-environment jsdom

// Extraído de Veiculo.tsx em 02/09/2026 pra Despesas Fixas também usar —
// o que se testa aqui é o contrato em si: linha abre menu (não a edição
// direto), Editar/Excluir chamam o que foi passado, `extra` fica fora do
// botão da linha.

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemComMenu from "./ItemComMenu";

describe("ItemComMenu", () => {
  test("mostra nome, detalhe e valor", () => {
    render(
      <ItemComMenu
        nome="Netflix"
        detalhe="Assinaturas · dia 5"
        valor="€ 15,99"
        aoEditar={() => {}}
        aoExcluir={() => {}}
      />,
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Assinaturas · dia 5")).toBeInTheDocument();
    expect(screen.getByText("€ 15,99")).toBeInTheDocument();
  });

  test("clicar na linha abre o menu, não chama aoEditar direto", async () => {
    const aoEditar = vi.fn();
    render(
      <ItemComMenu nome="Netflix" detalhe="Assinaturas" aoEditar={aoEditar} aoExcluir={() => {}} />,
    );
    await userEvent.click(screen.getByText("Netflix"));

    expect(aoEditar).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  test('"Editar" no menu chama aoEditar', async () => {
    const aoEditar = vi.fn();
    render(
      <ItemComMenu nome="Netflix" detalhe="Assinaturas" aoEditar={aoEditar} aoExcluir={() => {}} />,
    );
    await userEvent.click(screen.getByText("Netflix"));
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    expect(aoEditar).toHaveBeenCalledTimes(1);
  });

  test('"Excluir" no menu chama aoExcluir', async () => {
    const aoExcluir = vi.fn();
    render(
      <ItemComMenu
        nome="Netflix"
        detalhe="Assinaturas"
        aoEditar={() => {}}
        aoExcluir={aoExcluir}
      />,
    );
    await userEvent.click(screen.getByText("Netflix"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect(aoExcluir).toHaveBeenCalledTimes(1);
  });

  test("`extra` fica fora do botão da linha, continua clicável por conta própria", async () => {
    const aoClicarExtra = vi.fn();
    render(
      <ItemComMenu
        nome="Netflix"
        detalhe="Assinaturas"
        aoEditar={() => {}}
        aoExcluir={() => {}}
        extra={<button onClick={aoClicarExtra}>Pendente</button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pendente" }));

    expect(aoClicarExtra).toHaveBeenCalledTimes(1);
    // Clicar no extra não abriu o menu de ações da linha.
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  test("aceita um ícone embutido no detalhe, não só texto puro", () => {
    render(
      <ItemComMenu
        nome="Seguro"
        detalhe={
          <>
            dia 10 <span role="img" aria-label="débito automático" />
          </>
        }
        aoEditar={() => {}}
        aoExcluir={() => {}}
      />,
    );
    expect(screen.getByLabelText("débito automático")).toBeInTheDocument();
  });
});
