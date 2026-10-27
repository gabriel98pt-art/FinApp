// Qual KPI fica com o número grande do quadro de resumo de cada página.

import type { ConfigConta } from "../types";

export type TomKpi = "neutro" | "acento" | "verde" | "vermelho" | "amarelo" | "tvde";

/** Cor do VALOR de um KPI. O tom é só isto: nunca um fundo nem uma aura
 *  colorida no quadro. "neutro" é o texto normal. Verde continua a ser só de
 *  receita e do que é positivo, como já era. */
export const COR_DO_TOM: Record<TomKpi, string> = {
  neutro: "var(--txt)",
  acento: "var(--blu-txt)",
  verde: "var(--grn)",
  vermelho: "var(--red)",
  amarelo: "var(--ylw)",
  tvde: "var(--tvde)",
};

/** A CHAVE do KPI em destaque numa página. `chaves` são as dos KPIs que a
 *  página mostra, na ordem da tela. Precedência:
 *   1. a escolha guardada em `kpiDestaque`, se ainda casar com um KPI da tela;
 *   2. o primeiro da escolha antiga de `kpisMobile` que case (quem já tinha
 *      escolhido 2 KPIs para o telemóvel mantém o primeiro como destaque);
 *   3. o primeiro KPI da página.
 *  Uma chave que já não existe (KPI renomeado) cai no passo seguinte em vez de
 *  deixar o quadro sem número grande. */
export function chaveEmDestaque(
  pagina: string | undefined,
  chaves: string[],
  cfg: Pick<ConfigConta, "kpiDestaque" | "kpisMobile">,
): string | undefined {
  if (chaves.length === 0) return undefined;
  if (pagina) {
    const guardada = cfg.kpiDestaque?.[pagina];
    if (guardada && chaves.includes(guardada)) return guardada;
    const antiga = cfg.kpisMobile?.[pagina]?.find((c) => chaves.includes(c));
    if (antiga) return antiga;
  }
  return chaves[0];
}
