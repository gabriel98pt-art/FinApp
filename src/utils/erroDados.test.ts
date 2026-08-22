import { describe, expect, test } from "vitest";
import { mensagemDeErroDados } from "./erroDados";

/** Erro como o Realtime Database de verdade lança — Error comum, `.code`
 *  pendurado à mão (ver errorForServerCode em @firebase/database), não um
 *  FirebaseError. É a forma exata que motivou este arquivo. */
function erroDoFirebase(code: string, mensagem: string): Error {
  const err = new Error(mensagem);
  (err as Error & { code: string }).code = code;
  return err;
}

describe("mensagemDeErroDados", () => {
  test("erro do Firebase (com .code): usa o fallback, nunca o texto técnico", () => {
    const err = erroDoFirebase(
      "PERMISSION_DENIED",
      "PERMISSION_DENIED at /users/u1/fin_v5: Client doesn't have permission to access the desired data.",
    );

    expect(mensagemDeErroDados(err, "Não foi possível adicionar.")).toBe(
      "Não foi possível adicionar.",
    );
  });

  test("erro nosso, deliberado (sem .code): mostra a mensagem, ela já foi escrita pra isso", () => {
    const err = new Error("Já existe um cartão com esse nome.");

    expect(mensagemDeErroDados(err, "Não foi possível adicionar.")).toBe(
      "Já existe um cartão com esse nome.",
    );
  });

  test("erro nosso sem mensagem: cai no fallback, uma string vazia não ajuda ninguém", () => {
    const err = new Error("");

    expect(mensagemDeErroDados(err, "Não foi possível adicionar.")).toBe(
      "Não foi possível adicionar.",
    );
  });

  test("algo que nem é um Error (ex. um throw de string, ou undefined): fallback", () => {
    expect(mensagemDeErroDados("falhou", "Não foi possível adicionar.")).toBe(
      "Não foi possível adicionar.",
    );
    expect(mensagemDeErroDados(undefined, "Não foi possível adicionar.")).toBe(
      "Não foi possível adicionar.",
    );
  });

  test("outros códigos comuns do RTDB (TOO_BIG, UNAVAILABLE) também caem no fallback", () => {
    expect(mensagemDeErroDados(erroDoFirebase("TOO_BIG", "grande demais"), "Falhou.")).toBe(
      "Falhou.",
    );
    expect(mensagemDeErroDados(erroDoFirebase("UNAVAILABLE", "indisponível"), "Falhou.")).toBe(
      "Falhou.",
    );
  });
});
