// Ordenação da lista de Parcelas (item 14, variante da tela). Estende as 4
// ordens genéricas de `utils/ordem.ts` com quatro que só fazem sentido para uma
// compra parcelada — e por isso NÃO entram no `Ordem` que Despesas usa.
//
// As quatro usam exatamente as mesmas funções puras que os KPIs da tela:
// "Débito mensal" soma `debitoMensalDaParcela` e "Falta pagar" soma
// `valorQuitacao`. Ordenar por elas é ordenar pela contribuição de cada
// parcela ao KPI correspondente — e as duas de valor da parcela distinguem a
// compra cara-por-mês da compra apenas grande no total.

import type { Parcela, YearMonth } from "../types";
import { compararPorOrdem, ORDENS, ROTULOS_ORDEM, type Ordem } from "./ordem";
import {
  debitoMensalDaParcela,
  parcelaQuitada,
  proximoMesEmAberto,
  valorQuitacao,
} from "./parcelas";

export type OrdemParcela =
  Ordem | "proximoVencimento" | "valorRestante" | "maiorValorParcela" | "menorValorParcela";

export const ORDENS_PARCELA: OrdemParcela[] = [
  ...ORDENS,
  "proximoVencimento",
  "valorRestante",
  "maiorValorParcela",
  "menorValorParcela",
];

export const ROTULOS_ORDEM_PARCELA: Record<OrdemParcela, string> = {
  ...ROTULOS_ORDEM,
  proximoVencimento: "Próximo vencimento",
  valorRestante: "Valor restante",
  maiorValorParcela: "Maior valor da parcela",
  menorValorParcela: "Menor valor da parcela",
};

/** Comparador da lista de parcelas. As 4 ordens genéricas caem em
 *  `compararPorOrdem`, com `data` = mês da primeira parcela e `valor` = total
 *  da compra (o mesmo que a tela já usava). */
export function compararParcelas(
  ordem: OrdemParcela,
  /** Mês de referência — o que a tela está a mostrar. Decide o que já conta
   *  como pago numa parcela em débito automático (ver `estaEfetivamentePaga`). */
  mesReferencia?: YearMonth,
): (a: Parcela, b: Parcela) => number {
  if (ordem === "proximoVencimento") {
    // Mais cedo primeiro. Parcela sem mês em aberto (quitada) vai pro fim.
    return (a, b) => {
      const ma = proximoMesEmAberto(a, mesReferencia);
      const mb = proximoMesEmAberto(b, mesReferencia);
      if (ma === undefined && mb === undefined) return 0;
      if (ma === undefined) return 1;
      if (mb === undefined) return -1;
      return ma < mb ? -1 : ma > mb ? 1 : 0;
    };
  }
  if (ordem === "valorRestante") {
    // Maior primeiro — quitada tem restante 0 e cai naturalmente pro fim.
    return (a, b) => valorQuitacao(b, mesReferencia) - valorQuitacao(a, mesReferencia);
  }
  // As duas ordens genéricas de valor olham o total da compra, que mistura a
  // compra grande paga em muitas vezes com a pequena paga em duas. Estas duas
  // olham só o que sai no mês — a mesma conta do KPI "Débito mensal". A quitada
  // tem mensalidade 0 e cai pro fim das duas maneiras: em "maior" por ser o
  // menor valor, em "menor" porque o grupo dela já vai depois de qualquer uma
  // em aberto (ver `parcelasVisiveis`).
  if (ordem === "maiorValorParcela") {
    return (a, b) =>
      debitoMensalDaParcela(b, mesReferencia) - debitoMensalDaParcela(a, mesReferencia);
  }
  if (ordem === "menorValorParcela") {
    return (a, b) =>
      debitoMensalDaParcela(a, mesReferencia) - debitoMensalDaParcela(b, mesReferencia);
  }
  const generico = compararPorOrdem<{ data: string; valor: number }>(ordem);
  return (a, b) =>
    generico({ data: a.primeiroMes, valor: a.total }, { data: b.primeiroMes, valor: b.total });
}

/** A lista como a tela a mostra: as que ainda têm mês em aberto SEMPRE antes
 *  das quitadas (a ordem escolhida manda dentro de cada grupo).
 *
 *  Com `apenasQuitadas` ligado é o contrário: só as quitadas, para rever o
 *  histórico de compras já pagas. Desligado — o padrão — mostra tudo. */
export function parcelasVisiveis(
  parcelas: Parcela[],
  ordem: OrdemParcela,
  apenasQuitadas = false,
  mesReferencia?: YearMonth,
): Parcela[] {
  const comparar = compararParcelas(ordem, mesReferencia);
  const ordenar = (lista: Parcela[]) => [...lista].sort(comparar);
  if (apenasQuitadas) return ordenar(parcelas.filter((p) => parcelaQuitada(p, mesReferencia)));
  const ativas = ordenar(parcelas.filter((p) => !parcelaQuitada(p, mesReferencia)));
  return [...ativas, ...ordenar(parcelas.filter((p) => parcelaQuitada(p, mesReferencia)))];
}
