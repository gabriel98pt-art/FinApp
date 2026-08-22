// Traduz um erro de escrita pro toast — achado da auditoria de Arquitetura:
// vários lugares faziam `err instanceof Error ? err.message : fallback`, que
// parece seguro mas não é. Erros do Realtime Database chegam como um `Error`
// COMUM, não um `FirebaseError` (ao contrário do Firebase Auth) — o SDK
// (errorForServerCode, em @firebase/database) faz `new Error(...)` e só
// depois pendura um `.code` à mão (`PERMISSION_DENIED`, `TOO_BIG`,
// `UNAVAILABLE`...). Como o app também lança `Error`s deliberados e já
// escritos pra se lerem (ex. "Já existe um cartão com esse nome."), o
// `instanceof Error` sozinho não distingue os dois — e o erro técnico do
// Firebase acabava aparecendo cru no toast de quem só estava a usar o app.
//
// O `.code` é a distinção real: só o SDK o anexa. Um erro nosso nunca tem.

/** `err` tem um `.code` de string — sinal de que veio do SDK do Firebase,
 *  não de um `throw new Error(...)` nosso. */
function temCodigoDoFirebase(err: Error): boolean {
  return typeof (err as { code?: unknown }).code === "string";
}

/** Mensagem certa pro toast: a do erro, se for um erro NOSSO (deliberado,
 *  já escrito pra se ler); o `fallback` genérico, se vier do SDK (técnico,
 *  não serve pra quem está a usar o app) ou não for nem um `Error`. */
export function mensagemDeErroDados(err: unknown, fallback: string): string {
  if (err instanceof Error && !temCodigoDoFirebase(err) && err.message) return err.message;
  return fallback;
}
