/** Ids do par separador ↔ painel do padrão ARIA de abas.
 *
 *  Vivem aqui, e não em `AbaTransicao.tsx`, por causa do Fast Refresh: um
 *  ficheiro que exporta um componente E outra coisa qualquer deixa de poder
 *  ser recarregado a quente.
 *
 *  Os dois lados do par precisam de concordar no formato do id — o botão
 *  aponta para o painel com `aria-controls`, o painel aponta de volta para o
 *  botão com `aria-labelledby`. Escrever o formato à mão nos dois sítios é
 *  como se perde a ligação sem nada falhar à vista. */

/** Id do botão de uma aba (`role="tab"`). */
export const idAba = (aba: string) => `aba-${aba}`;

/** Id do painel de conteúdo de uma aba (`role="tabpanel"`). */
export const idPainelAba = (aba: string) => `painel-${aba}`;
