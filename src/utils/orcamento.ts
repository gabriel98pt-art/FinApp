// Orçamento vs. realizado por categoria (seção 4.8) — função pura.

import type { Cents, DespesaCorrente, YearMonth } from "../types";
import { despesasNosTotais, doMes } from "./calculos";

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
 *  primeiro. */
export function statusOrcamentoMes(
  despesasCorrentes: DespesaCorrente[],
  orcamentos: Record<string, Cents>,
  ym: YearMonth,
): StatusOrcamento[] {
  const doMesReal = despesasNosTotais(doMes(despesasCorrentes, ym));
  const gastoPorCategoria = new Map<string, Cents>();
  for (const d of doMesReal) {
    gastoPorCategoria.set(d.categoria, (gastoPorCategoria.get(d.categoria) ?? 0) + d.valor);
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
