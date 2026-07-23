// Backup completo da conta (seção 4.6): exporta toda a árvore fin_v5 como
// JSON pra download, e restaura de um arquivo — sempre com confirmação da UI
// antes de sobrescrever (a checagem de confirmação vive na tela, não aqui).

import { get, ref, set } from "firebase/database";
import { db } from "./firebase";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

interface ArquivoBackup {
  versao: 1;
  exportadoEm: string;
  dados: unknown;
}

export async function exportarBackup(uid: string): Promise<string> {
  const snap = await get(ref(db, raiz(uid)));
  const arquivo: ArquivoBackup = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    dados: snap.val() ?? {},
  };
  return JSON.stringify(arquivo, null, 2);
}

/** Sobrescreve TODOS os dados da conta pelo conteúdo do backup. */
export async function importarBackup(uid: string, json: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Arquivo não é um JSON válido.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("dados" in parsed) ||
    typeof (parsed as ArquivoBackup).dados !== "object"
  ) {
    throw new Error("Formato de backup não reconhecido.");
  }
  await set(ref(db, raiz(uid)), (parsed as ArquivoBackup).dados);
}
