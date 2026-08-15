// Camada de autenticação — componentes nunca falam com o Firebase direto.

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
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

/** Confirma que quem está a pedir a operação sabe mesmo a senha, e devolve o
 *  utilizador pronto a usar.
 *
 *  O Firebase recusa trocar a senha ou apagar a conta quando o login já é
 *  antigo (`auth/requires-recent-login`), e com razão: sem isto, bastava
 *  apanhar um telemóvel destrancado com a sessão aberta para tomar a conta ou
 *  destruí-la. Reautenticar aqui transforma esse erro numa pergunta simples
 *  ("qual é a sua senha?") em vez de um beco sem saída. */
async function reautenticar(senha: string): Promise<User> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Sessão expirada. Entre de novo para continuar.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senha));
  return user;
}

/** Troca a senha de quem já está autenticado. */
export async function alterarSenha(senhaAtual: string, senhaNova: string): Promise<void> {
  const user = await reautenticar(senhaAtual);
  await updatePassword(user, senhaNova);
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
      case "auth/requires-recent-login":
        return "Por segurança, saia e entre de novo antes de repetir esta ação.";
      default:
        return "Não foi possível concluir. Tente de novo.";
    }
  }
  return "Não foi possível concluir. Tente de novo.";
}

/** Como `mensagemDeErroAuth`, mas para ecrãs onde a senha pedida é a ATUAL
 *  (trocar senha, apagar conta).
 *
 *  Existe por causa de uma única palavra: o `mensagemDeErroAuth` responde
 *  "E-mail ou senha incorretos", que na tela de login está certo mas aqui
 *  manda a pessoa procurar um erro no e-mail que ela nem escreveu. Aqui só
 *  pode ser a senha, e dizê-lo poupa a confusão. */
export function mensagemDeErroSenhaAtual(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      return "A senha atual está incorreta.";
    }
    return mensagemDeErroAuth(err);
  }
  // Erros nossos (ex. sessão sem e-mail) já vêm escritos para se lerem.
  if (err instanceof Error && err.message) return err.message;
  return mensagemDeErroAuth(err);
}
