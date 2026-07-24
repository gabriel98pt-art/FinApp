// Pilha de undo/redo (seção 4.7) — portada do financas.html (linhas
// ~2504-2544), JÁ NA VERSÃO CORRIGIDA (a spec documenta um bug antigo desse
// mecanismo; este é o fix, não a lógica ingênua). Funções puras: o chamador
// entra com o estado já serializado (string) e um snapshot em si é só uma
// entrada dessa string — nenhuma dependência de Firebase/DOM aqui.
//
// Cada entrada da pilha representa o estado ANTES de uma edição (snapshot()
// é chamado antes de mutar). O estado "ao vivo" atual (depois da última
// edição) nunca é empilhado até o primeiro undo precisar dele.

const LIMITE_PILHA = 50;

export interface HistoricoStack {
  pilha: string[];
  indice: number;
}

export function pilhaVazia(): HistoricoStack {
  return { pilha: [], indice: -1 };
}

/** snapshot(): antes de uma mutação, empilha o estado ATUAL (pré-mutação).
 *  Trunca qualquer "redo" pendente (edição nova a partir de um undo invalida
 *  o futuro alternativo) e limita a 50 entradas, descartando a mais antiga. */
export function empilhar(h: HistoricoStack, estadoAtual: string): HistoricoStack {
  const pilha = h.pilha.slice(0, h.indice + 1);
  pilha.push(estadoAtual);
  if (pilha.length > LIMITE_PILHA) pilha.shift();
  return { pilha, indice: pilha.length - 1 };
}

export interface ResultadoHistorico {
  h: HistoricoStack;
  /** Estado a restaurar, ou `null` se não havia nada a desfazer/refazer. */
  estado: string | null;
}

/** undo(): se o índice atual aponta pro TOPO da pilha, estamos no estado "ao
 *  vivo" (pós-última edição, nunca guardado) — captura ele ANTES de
 *  decrementar, senão um "Refazer" depois não consegue voltar pra ele.
 *
 *  BUG DA ORIGEM A NÃO REPRODUZIR (seção 4.7): decrementar o índice ANTES de
 *  capturar esse estado ao vivo faz o primeiro undo, depois de 2 edições
 *  seguidas, pular direto 2 passos pra trás — perdendo a edição intermediária
 *  em silêncio (e pra sempre: como o estado nunca foi empilhado, nem redo
 *  recupera). O teste `historico.test.ts` reproduz exatamente esse cenário. */
export function desfazer(h: HistoricoStack, estadoAoVivo: string): ResultadoHistorico {
  if (h.indice < 0) return { h, estado: null };
  let pilha = h.pilha;
  let indice = h.indice;
  if (indice === pilha.length - 1) {
    pilha = [...pilha, estadoAoVivo];
    indice = pilha.length - 1;
  }
  if (indice <= 0) return { h: { pilha, indice }, estado: null };
  indice--;
  return { h: { pilha, indice }, estado: pilha[indice] };
}

/** redo(): incrementa e lê, sem surpresas — o estado seguinte já está
 *  garantidamente na pilha (empilhado pelo undo anterior). */
export function refazer(h: HistoricoStack): ResultadoHistorico {
  if (h.indice >= h.pilha.length - 1) return { h, estado: null };
  const indice = h.indice + 1;
  return { h: { pilha: h.pilha, indice }, estado: h.pilha[indice] };
}

export function podeDesfazer(h: HistoricoStack): boolean {
  return h.indice > 0;
}

export function podeRefazer(h: HistoricoStack): boolean {
  return h.indice < h.pilha.length - 1;
}
