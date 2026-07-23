import type { Cents, Id, YearMonth } from "./common";

/** Compra parcelada ativa (antigo `par`, seção 4.3). Cada mês gera um
 *  lançamento de despesa vinculado por `parcelaId`/`parcelaMes`. */
export interface Parcela {
  id: Id;
  descricao: string;
  valorParcela: Cents;
  totalParcelas: number;
  /** Mês da primeira parcela. */
  primeiroMes: YearMonth;
  /** Cartão vinculado — se for de crédito, o débito mensal entra na fatura. */
  cartao?: string | null;
  categoria?: string;
  /** Marcada quando houve quitação antecipada (soma das restantes num único
   *  lançamento, removendo os futuros individuais). */
  quitada?: boolean;
}
