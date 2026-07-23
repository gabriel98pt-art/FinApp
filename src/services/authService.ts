// Camada de autenticação — componentes nunca falam com o Firebase direto.

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "./firebase";

export interface Sessao {
  uid: string;
  email: string | null;
}

export async function entrar(email: string, senha: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, senha);
}

export async function cadastrar(email: string, senha: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, senha);
}

export async function sair(): Promise<void> {
  await signOut(auth);
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
        return "A senha precisa de pelo menos 6 caracteres.";
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
