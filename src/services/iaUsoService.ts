// Cota diária de perguntas à camada 2, em users/{uid}/fin_v5/iaUso/{YYYY-MM-DD}.
//
// Serve para o custo da IA não depender do humor de quem está a usar: 20
// perguntas por dia e por conta. É uma cota de cortesia, não uma fronteira de
// segurança — as regras do RTDB deixam cada pessoa escrever no seu próprio nó,
// portanto quem quiser mesmo mexer no contador consegue. O que impede a conta
// de disparar de verdade é o tecto da cota gratuita do Gemini, do lado do
// servidor; isto aqui evita que uma pessoa sozinha a esgote para as outras.

import { ref, runTransaction } from "firebase/database";
import { db } from "./firebase";

export const LIMITE_DIARIO_IA = 20;

const caminho = (uid: string, dia: string) => `users/${uid}/fin_v5/iaUso/${dia}`;

/** Tenta consumir uma pergunta da cota do dia.
 *
 *  Transação e não leitura-seguida-de-escrita: a app corre em várias abas e no
 *  telemóvel ao mesmo tempo, e duas perguntas simultâneas com `get` + `set`
 *  gravariam ambas o mesmo valor — o contador andaria mais devagar do que o
 *  gasto real.
 *
 *  Devolve `false` quando a cota do dia já acabou (a transação é abortada e
 *  nada é gravado) e também quando a escrita falha: sem conseguir contar, o
 *  seguro é não deixar chamar a IA. */
export async function consumirCotaIA(uid: string, dia: string): Promise<boolean> {
  try {
    const resultado = await runTransaction(ref(db, caminho(uid, dia)), (atual: unknown) => {
      const usado = typeof atual === "number" ? atual : 0;
      // `undefined` aborta a transação sem gravar nada.
      if (usado >= LIMITE_DIARIO_IA) return undefined;
      return usado + 1;
    });
    return resultado.committed;
  } catch {
    return false;
  }
}
