// Registo de erros do app na própria conta do Firebase.
//
// Sem isto, um crash em produção só se sabe quando o utilizador repara e o
// descreve de memória — foi esse ciclo lento que atrasou o diagnóstico do
// crash de importação no iPhone. Um serviço externo (Sentry e afins) é
// desproporcionado para um app de uso pessoal; o Firebase da conta já está
// aqui e já é privado por regra de segurança.
//
// Fica FORA da árvore `fin_v5` de propósito: essa árvore é sobrescrita
// inteira por restaurar-backup e por desfazer/refazer, e um registo de erros
// não pode desaparecer por causa dessas operações. As regras do
// database.rules.json já cobrem `users/$uid/**`.

import { get, onValue, push, ref, remove, update } from "firebase/database";
import { db } from "./firebase";

export interface ErroRegistado {
  id: string;
  mensagem: string;
  pilha?: string;
  url: string;
  timestamp: number;
}

/** Teto de registos guardados: chega para reconstruir o que aconteceu numa
 *  sessão e não cresce para sempre. */
const MAX_REGISTOS = 30;

const caminho = (uid: string) => `users/${uid}/erros_app`;

/** Grava um erro e poda os mais antigos acima do teto.
 *
 *  Nunca lança: isto corre no caminho de erro do app, e falhar aqui (sem
 *  rede, regra recusada) não pode virar um segundo erro por cima do primeiro. */
export async function registrarErro(
  uid: string,
  erro: { mensagem: string; pilha?: string; url: string; timestamp: number },
): Promise<void> {
  try {
    const novo = push(ref(db, caminho(uid)));
    await update(ref(db, caminho(uid)), {
      [novo.key!]: {
        mensagem: erro.mensagem,
        // O RTDB rejeita `undefined`; sem pilha, a chave simplesmente não vai.
        ...(erro.pilha ? { pilha: erro.pilha } : {}),
        url: erro.url,
        timestamp: erro.timestamp,
      },
    });

    const snap = await get(ref(db, caminho(uid)));
    const todos = (snap.val() ?? {}) as Record<string, unknown>;
    const chaves = Object.keys(todos);
    if (chaves.length <= MAX_REGISTOS) return;
    // As chaves do push() são ordenáveis por ordem de criação — as primeiras
    // são as mais antigas.
    const aRemover = chaves.sort().slice(0, chaves.length - MAX_REGISTOS);
    await update(ref(db, caminho(uid)), Object.fromEntries(aRemover.map((k) => [k, null])));
  } catch {
    // Sem rede ou sem permissão: o erro original já foi tratado por quem
    // chamou (fallback do ErrorBoundary, console). Aqui não há mais nada a
    // fazer sem piorar a situação.
  }
}

/** Observa os erros da conta, do mais recente para o mais antigo. */
export function observarErros(uid: string, cb: (erros: ErroRegistado[]) => void): () => void {
  return onValue(
    ref(db, caminho(uid)),
    (snap) => {
      const val = (snap.val() ?? {}) as Record<string, Omit<ErroRegistado, "id">>;
      const lista = Object.entries(val).map(([id, dados]) => ({ ...dados, id }));
      lista.sort((a, b) => b.timestamp - a.timestamp);
      cb(lista);
    },
    // Falhar a leitura da lista de erros não merece um aviso na tela: a
    // secção fica simplesmente vazia.
    () => cb([]),
  );
}

/** Apaga todos os registos — para limpar depois de resolver um problema. */
export async function limparErros(uid: string): Promise<void> {
  await remove(ref(db, caminho(uid)));
}
