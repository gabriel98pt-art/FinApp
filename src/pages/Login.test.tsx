// @vitest-environment jsdom

// A tela de autenticação — não tinha nenhum teste antes deste arquivo. O que
// se protege aqui: os três modos (entrar/cadastrar/recuperar) mostram os
// campos certos, o erro é anunciado (role="alert") e associado aos campos
// via aria-describedby — achado da auditoria de Acessibilidade: sem isso, um
// leitor de tela que volta pro campo depois do erro não repete a mensagem.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const entrar = vi.fn(async () => {});
const cadastrar = vi.fn(async () => {});
const enviarRecuperacaoSenha = vi.fn(async () => {});

vi.mock("../services/authService", () => ({
  entrar: (...a: unknown[]) => entrar(...(a as [])),
  cadastrar: (...a: unknown[]) => cadastrar(...(a as [])),
  enviarRecuperacaoSenha: (...a: unknown[]) => enviarRecuperacaoSenha(...(a as [])),
  mensagemDeErroAuth: () => "E-mail ou senha incorretos.",
  SENHA_MINIMA: 8,
}));

const Login = (await import("./Login")).default;

beforeEach(() => {
  entrar.mockClear();
  cadastrar.mockClear();
  enviarRecuperacaoSenha.mockClear();
});

async function preencherEEnviar(email = "eu@exemplo.pt", senha = "senha1234") {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  if (screen.queryByLabelText("Senha")) {
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
  }
  fireEvent.click(screen.getByRole("button", { name: /Entrar|Cadastrar|Enviar link/ }));
}

describe("Login", () => {
  test("começa no modo entrar, com e-mail e senha", () => {
    render(<Login />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  test("recuperar senha esconde o campo de senha — não faz sentido pedi-la", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" }));
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  test("erro de login é anunciado (role=alert)", async () => {
    entrar.mockRejectedValueOnce(new Error("falhou"));
    render(<Login />);

    await preencherEEnviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  });

  test("com erro, os campos ficam descritos por ele (aria-describedby) — sem isso, o leitor de tela não repete a mensagem ao voltar pro campo", async () => {
    entrar.mockRejectedValueOnce(new Error("falhou"));
    render(<Login />);

    await preencherEEnviar();
    await screen.findByRole("alert");

    const emailInput = screen.getByLabelText("E-mail");
    const senhaInput = screen.getByLabelText("Senha");
    const idErro = screen.getByRole("alert").id;

    expect(idErro).toBeTruthy();
    expect(emailInput).toHaveAttribute("aria-describedby", idErro);
    expect(senhaInput).toHaveAttribute("aria-describedby", idErro);
  });

  test("sem erro, os campos não têm aria-describedby nenhum", () => {
    render(<Login />);
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-describedby");
  });

  test("trocar de modo limpa o erro do modo anterior", async () => {
    entrar.mockRejectedValueOnce(new Error("falhou"));
    render(<Login />);
    await preencherEEnviar();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /Esqueci a senha/ }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("recuperação bem-sucedida mostra o mesmo aviso exista ou não a conta", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" }));

    await preencherEEnviar("qualquer@exemplo.pt");

    expect(
      await screen.findByText(/Se esse e-mail tiver conta, enviámos um link/),
    ).toBeInTheDocument();
  });
});
