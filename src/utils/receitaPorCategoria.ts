// Receita do mês repartida por fonte. Bem mais simples que o lado da despesa:
// receita não tem fixa, parcela nem veículo — é só somar por `fonte`.

import type { Cents, Receita, YearMonth } from "../types";
import { doMes } from "./calculos";

export interface FatiaFonte {
  fonte: string;
  valor: Cents;
}

/** Fontes do mês ordenadas da maior pra menor. Fonte vazia entra como
 *  "Outros", e total zero fica de fora (mesma regra das fatias de despesa). */
export function receitaPorFonteMes(receitas: Receita[], ym: YearMonth): FatiaFonte[] {
  const porFonte = new Map<string, Cents>();
  for (const r of doMes(receitas, ym)) {
    const fonte = r.fonte || "Outros";
    porFonte.set(fonte, (porFonte.get(fonte) ?? 0) + r.valor);
  }
  return [...porFonte.entries()]
    .filter(([, valor]) => valor !== 0)
    .map(([fonte, valor]) => ({ fonte, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** A fonte que mais rendeu no mês, ou `null` se não houve receita. */
export function maiorFonteMes(receitas: Receita[], ym: YearMonth): FatiaFonte | null {
  return receitaPorFonteMes(receitas, ym)[0] ?? null;
}
