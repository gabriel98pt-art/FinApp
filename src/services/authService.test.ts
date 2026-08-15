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

let credencialUsada: { email: string; senha: string } | null = null;
const reauthenticateWithCredential = vi.fn(
  async (_user: unknown, cred: { email: string; senha: string }) => {
    credencialUsada = cred;
  },
);
const updatePassword = vi.fn(async (_user: unknown, senha: string) => {
  senhaGravada = senha;
});
let senhaGravada = "";

/** A sessão que o `auth.currentUser` devolve. Trocável por null nos testes de
 *  sessão perdida. */
let utilizador: { uid: string; email: string | null } | null = null;
const auth = {
  get currentUser() {
    return utilizador;
  },
};

vi.mock("./firebase", () => ({ auth, db: {} }));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(async () => {}),
  EmailAuthProvider: {
    credential: (email: string, senha: string) => ({ email, senha }),
  },
  onAuthStateChanged: vi.fn(() => () => {}),
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  updatePassword,
}));

const s = await import("./authService");

beforeEach(() => {
  emailPedido = "";
  senhaGravada = "";
  utilizador = { uid: "u1", email: "eu@exemplo.pt" };

  sendPasswordResetEmail.mockClear();
  sendPasswordResetEmail.mockImplementation(async (_auth: unknown, email: string) => {
    emailPedido = email;
  });

  credencialUsada = null;
  reauthenticateWithCredential.mockClear();
  reauthenticateWithCredential.mockImplementation(
    async (_user: unknown, cred: { email: string; senha: string }) => {
      credencialUsada = cred;
    },
  );

  updatePassword.mockClear();
  updatePassword.mockImplementation(async (_user: unknown, senha: string) => {
    senhaGravada = senha;
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

describe("alterarSenha", () => {
  test("confirma a senha atual ANTES de gravar a nova", async () => {
    const ordem: string[] = [];
    reauthenticateWithCredential.mockImplementation(async () => {
      ordem.push("reautenticou");
    });
    updatePassword.mockImplementation(async () => {
      ordem.push("gravou");
    });

    await s.alterarSenha("senha-antiga", "senha-nova-longa");

    // A ordem é o ponto: gravar primeiro e confirmar depois deixaria qualquer
    // sessão aberta trocar a senha sem saber a atual.
    expect(ordem).toEqual(["reautenticou", "gravou"]);
  });

  test("grava exatamente a senha nova pedida", async () => {
    await s.alterarSenha("senha-antiga", "senha-nova-longa");

    expect(senhaGravada).toBe("senha-nova-longa");
  });

  test("confirma com o e-mail da sessão e a senha ATUAL, não a nova", async () => {
    await s.alterarSenha("senha-antiga", "senha-nova-longa");

    expect(credencialUsada).toEqual({ email: "eu@exemplo.pt", senha: "senha-antiga" });
  });

  test("senha atual errada não chega a gravar nada", async () => {
    reauthenticateWithCredential.mockImplementation(async () => {
      throw new FirebaseError("auth/wrong-password", "errada");
    });

    await expect(s.alterarSenha("errada", "senha-nova-longa")).rejects.toThrow();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  test("sem sessão válida não tenta reautenticar", async () => {
    utilizador = null;

    await expect(s.alterarSenha("qualquer", "senha-nova-longa")).rejects.toThrow(/Sess/);
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });
});

describe("mensagemDeErroSenhaAtual", () => {
  test("senha errada aqui fala de senha, não de e-mail", () => {
    // Na tela de login "E-mail ou senha incorretos" está certo. Aqui mandava a
    // pessoa procurar um erro num e-mail que ela nem escreveu.
    const err = new FirebaseError("auth/wrong-password", "");
    expect(s.mensagemDeErroSenhaAtual(err)).toMatch(/senha atual/i);
    expect(s.mensagemDeErroSenhaAtual(err)).not.toMatch(/e-mail/i);
  });

  test("o auth/invalid-credential dos SDK novos diz o mesmo", () => {
    const err = new FirebaseError("auth/invalid-credential", "");
    expect(s.mensagemDeErroSenhaAtual(err)).toMatch(/senha atual/i);
  });

  test("outros erros do Firebase mantêm a tradução normal", () => {
    const err = new FirebaseError("auth/network-request-failed", "");
    expect(s.mensagemDeErroSenhaAtual(err)).toBe(s.mensagemDeErroAuth(err));
  });

  test("erro nosso passa a mensagem que já vem escrita", () => {
    expect(s.mensagemDeErroSenhaAtual(new Error("Sessão expirada."))).toBe("Sessão expirada.");
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
