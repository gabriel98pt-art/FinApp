// Camada de autenticação — componentes nunca falam com o Firebase direto.

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "./firebase";

export interface Sessao {
  uid: string;
  email: string | null;
}

/** Mínimo exigido em senhas NOVAS (cadastro e troca de senha). Acima dos 6 que
 *  o Firebase aceita: esta app guarda o histórico financeiro inteiro de
 *  alguém, e 6 caracteres é o que se põe num fórum, não numa conta destas.
 *
 *  Não vale no LOGIN de propósito — quem já tem conta antiga com senha curta
 *  tem de conseguir entrar. Exigir 8 ali não tornaria a senha dela mais forte,
 *  só a trancava fora dos próprios dados. */
export const SENHA_MINIMA = 8;

export async function entrar(email: string, senha: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, senha);
}

export async function cadastrar(email: string, senha: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, senha);
}

export async function sair(): Promise<void> {
  await signOut(auth);
}

/** Envia o link de redefinição de senha.
 *
 *  Resolve em silêncio quando o e-mail não tem conta: quem chama mostra
 *  sempre a mesma mensagem, aconteça o que acontecer. Sem isto, a tela de
 *  recuperação vira um verificador de quem tem conta aqui — basta ir tentando
 *  e-mails e ver qual dá erro. Numa app que guarda a vida financeira de
 *  alguém, confirmar "esta pessoa é cliente" já é vazar informação.
 *
 *  Erros reais (rede, e-mail malformado, excesso de tentativas) continuam a
 *  subir — esses o usuário precisa de ver. */
export async function enviarRecuperacaoSenha(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "auth/user-not-found") return;
    throw err;
  }
}

/** Observa a sessão; devolve a função de unsubscribe. */
export function observarSessao(cb: (sessao: Sessao | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    cb(user ? { uid: user.uid, email: user.email } : null);
  });
}

/** Traduz erros do Firebase Auth para mensagens amigáveis em português. */
export function mensagemDeErroAuth(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "E-mail ou senha incorretos.";
      case "auth/invalid-email":
        return "E-mail inválido.";
      case "auth/email-already-in-use":
        return "Já existe uma conta com este e-mail.";
      case "auth/weak-password":
        return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
      case "auth/too-many-requests":
        return "Muitas tentativas. Aguarde um pouco e tente de novo.";
      case "auth/network-request-failed":
        return "Sem ligação. Verifique a internet e tente de novo.";
      default:
        return "Não foi possível concluir. Tente de novo.";
    }
  }
  return "Não foi possível concluir. Tente de novo.";
}
