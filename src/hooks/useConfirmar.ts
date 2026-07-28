import { confirmarAcao } from "../stores/confirmarStore";

/** Devolve `confirmar(mensagem)`, que abre o diálogo do app e resolve com a
 *  escolha do usuário — a troca direta do `window.confirm`, mas assíncrona:
 *
 *  ```ts
 *  if (!(await confirmar("Excluir?"))) return;
 *  ```
 *
 *  A função é estável (vive no store), então serve como dependência de
 *  efeito/callback sem recriar nada. */
export function useConfirmar() {
  return confirmarAcao;
}
