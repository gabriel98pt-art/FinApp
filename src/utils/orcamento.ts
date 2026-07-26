// Orçamento vs. realizado por categoria (seção 4.8) — função pura.

import type { Cents, DespesaCorrente, Parcela, YearMonth } from "../types";
import { despesasNosTotais, doMes } from "./calculos";
import { mesesDaParcela, valorDaParcela } from "./parcelas";

export interface StatusOrcamento {
  categoria: string;
  gasto: Cents;
  teto: Cents;
  /** Pode passar de 100 quando estoura. */
  pct: number;
  estourado: boolean;
}

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
): StatusOrcamento[] {
  const doMesReal = despesasNosTotais(doMes(despesasCorrentes, ym));
  const gastoPorCategoria = new Map<string, Cents>();
  for (const d of doMesReal) {
    gastoPorCategoria.set(d.categoria, (gastoPorCategoria.get(d.categoria) ?? 0) + d.valor);
  }
  for (const p of parcelas.filter((p) => mesesDaParcela(p).includes(ym))) {
    if (ym === mesReal && !p.pagoPorMes[ym]) continue;
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
