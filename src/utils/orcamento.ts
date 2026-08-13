// Orçamento vs. realizado por categoria (seção 4.8) — função pura.

import type { Cents, DespesaCorrente, IsoDate, Parcela, YearMonth } from "../types";
import { despesasNosTotais, doMes } from "./calculos";
import { estaEfetivamentePaga, mesesDaParcela, valorDaParcela } from "./parcelas";
import { filtrarTransacoes, transacoesDoMes, type Transacao } from "./transacoes";

export interface StatusOrcamento {
  categoria: string;
  gasto: Cents;
  teto: Cents;
  /** Pode passar de 100 quando estoura. */
  pct: number;
  estourado: boolean;
}

/** % do teto a partir do qual uma categoria conta como "perto do limite" —
 *  ainda não estourou, mas já merece aviso. Fonte única: Registro Rápido,
 *  o card "Maior categoria" de Despesas e o resumo do Início usam o mesmo
 *  número, pra não haver um "perto" diferente em cada tela. */
export const LIMIAR_PERTO_ORCAMENTO = 80;

/** Gasto real vs. teto configurado, só para categorias com teto > 0
 *  (cfg.orcamentos). Ordenado por % gasto decrescente — o mais estourado
 *  primeiro. As parcelas entram pelo plano (não pelo lançamento espelho), na
 *  categoria própria e com a mesma regra mês corrente/mês fechado do resto do
 *  app. */
export function statusOrcamentoMes(
  despesasCorrentes: DespesaCorrente[],
  parcelas: Parcela[],
  orcamentos: Record<string, Cents>,
  ym: YearMonth,
  mesReal: YearMonth,
  /** Dia de hoje — dá precisão de DIA ao mês corrente, igual ao que
   *  `despesaRealizadaMes` e `transacoesDoMes` já faziam. Sem ele, uma parcela
   *  em débito automático que vence dia 20 já contava para o teto no dia 5, e
   *  a categoria aparecia estourada por dinheiro que ainda não tinha saído —
   *  enquanto o extrato de Transações, esse, só a mostrava depois do dia 20.
   *  Era essa a diferença entre os dois ecrãs.
   *
   *  Opcional para não partir quem chama sem ele: sem `hoje`, mês inteiro de
   *  uma vez, como sempre foi. */
  hoje?: IsoDate,
): StatusOrcamento[] {
  const doMesReal = despesasNosTotais(doMes(despesasCorrentes, ym));
  const gastoPorCategoria = new Map<string, Cents>();
  for (const d of doMesReal) {
    gastoPorCategoria.set(d.categoria, (gastoPorCategoria.get(d.categoria) ?? 0) + d.valor);
  }
  for (const p of parcelas.filter((p) => mesesDaParcela(p).includes(ym))) {
    if (ym === mesReal && !estaEfetivamentePaga(p, ym, mesReal, hoje)) continue;
    const cat = p.categoria ?? "Parcelas";
    gastoPorCategoria.set(cat, (gastoPorCategoria.get(cat) ?? 0) + valorDaParcela(p, ym));
  }

  return Object.entries(orcamentos)
    .filter(([, teto]) => teto > 0)
    .map(([categoria, teto]) => {
      const gasto = gastoPorCategoria.get(categoria) ?? 0;
      return {
        categoria,
        gasto,
        teto,
        pct: Math.round((gasto / teto) * 100),
        estourado: gasto > teto,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Os lançamentos por trás do `gasto` de UMA categoria — o que a folha de
 *  edição do teto mostra por baixo do número.
 *
 *  Vive ao lado de `statusOrcamentoMes` de propósito: a lista tem de somar
 *  exatamente o `gasto` que ela calcula, senão contradiz o número que está logo
 *  por cima. Manter as duas no mesmo ficheiro é o que torna essa amarra óbvia
 *  para quem mexer numa delas — e há teste a exigi-la.
 *
 *  Daí alimentar o `transacoesDoMes` só com os domínios que o orçamento mede:
 *  despesas correntes que contam nos totais (fora pagamento de fatura, ajuste
 *  de reconciliação e espelho de parcela) e as parcelas pelo plano. Fixas e
 *  veículo ficam de fora porque o orçamento por categoria também os deixa de
 *  fora; incluí-los mostrava linhas que o teto não conta.
 *
 *  E o "já saiu?" — o dia de vencimento de uma parcela em débito automático —
 *  continua a ser o do `transacoesDoMes`, não um segundo cálculo escrito aqui.
 *  Foi um segundo desses que pôs o orçamento e o extrato a discordarem sobre a
 *  mesma parcela (ver `coerenciaMesCorrente.test.ts`). */
export function gastosDaCategoriaMes(
  despesasCorrentes: DespesaCorrente[],
  parcelas: Parcela[],
  categoria: string,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): Transacao[] {
  const itens = transacoesDoMes(
    {
      receitas: [],
      despesasCorrentes: despesasNosTotais(despesasCorrentes),
      despesasFixas: [],
      parcelas,
      transferencias: [],
      veiculo: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
    },
    ym,
    mesReal,
    hoje,
  );
  // Mais recente primeiro, como o extrato.
  return filtrarTransacoes(itens, categoria, "").sort((a, b) =>
    a.data < b.data ? 1 : a.data > b.data ? -1 : 0,
  );
}
