// Ordenação das listas de lançamentos (item 14) — pura, testável, e fora do
// ficheiro do componente (que só pode exportar componentes, por causa do
// fast refresh).

/** Ordenações oferecidas pelo SeletorOrdem. */
export type Ordem = "recentes" | "antigas" | "maiorValor" | "menorValor";

export const ORDENS: Ordem[] = ["recentes", "antigas", "maiorValor", "menorValor"];

export const ROTULOS_ORDEM: Record<Ordem, string> = {
  recentes: "Mais recentes",
  antigas: "Mais antigas",
  maiorValor: "Maior valor",
  menorValor: "Menor valor",
};

/** Uma linha da folha "Ordenar por": ou uma opção simples, ou um PAR de
 *  ordens opostas (mesmo critério, direção oposta) que uma seta alterna —
 *  ver SeletorOrdemFolha. `desc` é o lado "maior/mais novo primeiro",
 *  `asc` o lado "menor/mais antigo primeiro".
 *
 *  Só apresentação: os valores por trás e os comparadores não sabem que a
 *  folha junta dois deles na mesma linha. */
export type LinhaOrdem<T extends string> =
  { tipo: "simples"; valor: T; rotulo: string } | { tipo: "par"; rotulo: string; desc: T; asc: T };

/** Compara dois itens conforme a ordem escolhida. `data` pode ser um IsoDate
 *  ou um YearMonth — a comparação é textual, que já ordena os dois formatos. */
export function compararPorOrdem<T extends { data: string; valor: number }>(
  ordem: Ordem,
): (a: T, b: T) => number {
  switch (ordem) {
    case "antigas":
      return (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
    case "maiorValor":
      return (a, b) => b.valor - a.valor;
    case "menorValor":
      return (a, b) => a.valor - b.valor;
    default:
      return (a, b) => (a.data > b.data ? -1 : a.data < b.data ? 1 : 0);
  }
}
