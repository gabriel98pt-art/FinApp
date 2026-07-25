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
