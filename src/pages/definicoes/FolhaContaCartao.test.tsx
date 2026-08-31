// @vitest-environment jsdom

// Criar conta/cartão mudou-se da tela de Cartões pra cá (31/08/2026). O que
// se testa é exatamente o que se perdeu ao sair de lá: nome + tipo continuam
// a chamar o mesmo serviço, com o mesmo tipo por omissão (crédito) e o mesmo
// aviso quando o nome vem vazio.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../../constants/configPadrao";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
const adicionarCartao = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({
  adicionarCartao: (...a: unknown[]) => adicionarCartao(...(a as [])),
}));

const FolhaContaCartao = (await import("./FolhaContaCartao")).default;

function abrir() {
  return render(<FolhaContaCartao cfg={CONFIG_PADRAO} uid="u1" aberta aoFechar={() => {}} />);
}

beforeEach(() => {
  adicionarCartao.mockClear();
});

describe("FolhaContaCartao", () => {
  test("cria com o tipo crédito por omissão", async () => {
    abrir();
    await userEvent.type(screen.getByLabelText("Nome da conta ou cartão"), "AB Gold");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(adicionarCartao).toHaveBeenCalledWith("u1", CONFIG_PADRAO, "AB Gold", "credit");
  });

  test("troca pra débito antes de criar", async () => {
    abrir();
    await userEvent.type(screen.getByLabelText("Nome da conta ou cartão"), "Conta Principal");
    await userEvent.click(screen.getByRole("button", { name: /Tipo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Débito" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(adicionarCartao).toHaveBeenCalledWith("u1", CONFIG_PADRAO, "Conta Principal", "debit");
  });

  test("nome vazio não chama o serviço", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(adicionarCartao).not.toHaveBeenCalled();
  });

  test("limpa o nome depois de criar", async () => {
    abrir();
    const campo = screen.getByLabelText("Nome da conta ou cartão");
    await userEvent.type(campo, "AB Gold");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(campo).toHaveValue("");
  });
});
