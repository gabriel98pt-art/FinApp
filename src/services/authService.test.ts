// Autenticação. O que se testa aqui não é "o Firebase funciona" — é o que o
// serviço decide POR CIMA dele, que é onde mora o risco:
//
//  - a recuperação de senha não pode revelar quem tem conta nesta app;
//  - um erro de rede não pode ser confundido com "e-mail não existe".

import { beforeEach, describe, expect, test, vi } from "vitest";
import { FirebaseError } from "firebase/app";

let emailPedido = "";
const sendPasswordResetEmail = vi.fn(async (_auth: unknown, email: string) => {
  emailPedido = email;
});

vi.mock("./firebase", () => ({ auth: {}, db: {} }));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(async () => {}),
  onAuthStateChanged: vi.fn(() => () => {}),
  sendPasswordResetEmail,
  signInWithEmailAndPassword: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}));

const s = await import("./authService");

beforeEach(() => {
  emailPedido = "";
  sendPasswordResetEmail.mockClear();
  sendPasswordResetEmail.mockImplementation(async (_auth: unknown, email: string) => {
    emailPedido = email;
  });
});

describe("enviarRecuperacaoSenha", () => {
  test("pede o link ao Firebase para o e-mail dado", async () => {
    await s.enviarRecuperacaoSenha("eu@exemplo.pt");

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(emailPedido).toBe("eu@exemplo.pt");
  });

  test("e-mail sem conta resolve em silêncio — senão a tela vira um verificador de clientes", async () => {
    sendPasswordResetEmail.mockImplementation(async () => {
      throw new FirebaseError("auth/user-not-found", "não existe");
    });

    // O ponto do teste é não rejeitar: quem chama mostra a mesma mensagem
    // exista ou não a conta, e não consegue distinguir os dois casos.
    await expect(s.enviarRecuperacaoSenha("ninguem@exemplo.pt")).resolves.toBeUndefined();
  });

  test("erro de rede sobe — esse o usuário precisa de ver", async () => {
    sendPasswordResetEmail.mockImplementation(async () => {
      throw new FirebaseError("auth/network-request-failed", "sem rede");
    });

    // Engolir este seria pior que inútil: a pessoa ficava à espera de um
    // e-mail que nunca chegou a ser pedido.
    await expect(s.enviarRecuperacaoSenha("eu@exemplo.pt")).rejects.toThrow();
  });

  test("erro que não é do Firebase também sobe", async () => {
    sendPasswordResetEmail.mockImplementation(async () => {
      throw new Error("qualquer outra coisa");
    });

    await expect(s.enviarRecuperacaoSenha("eu@exemplo.pt")).rejects.toThrow();
  });
});

describe("mensagemDeErroAuth", () => {
  test("traduz códigos conhecidos do Firebase", () => {
    const err = new FirebaseError("auth/email-already-in-use", "");
    expect(s.mensagemDeErroAuth(err)).toMatch(/já existe uma conta/i);
  });

  test("código desconhecido não vaza o texto cru do Firebase", () => {
    const err = new FirebaseError("auth/algo-que-ainda-nao-existe", "internal SDK detail");
    expect(s.mensagemDeErroAuth(err)).not.toMatch(/internal SDK detail/);
  });

  test("o que nem é erro do Firebase continua a ter mensagem", () => {
    expect(s.mensagemDeErroAuth("string solta")).toBeTruthy();
  });
});
