import type { Cents, Id, YearMonth } from "./common";

/** Compra parcelada (antigo `par`, seção 4.3). Comportamento portado do app
 *  de referência:
 *  - o VALOR de cada mês vem da divisão exata do total em centavos (o resto
 *    vai às primeiras parcelas: 55,99 em 3× → 18,67 + 18,66 + 18,66), a não
 *    ser que haja ajuste manual daquele mês em `overridePorMes`;
 *  - cada mês pago gera um lançamento de despesa vinculado por
 *    `parcelaId`/`parcelaMes` (origem 'parc');
 *  - `autoDebit` + `cartao`: o débito mensal entra no cálculo da fatura
 *    do cartão (seção 4.1). */
export interface Parcela {
  id: Id;
  descricao: string;
  /** Total da compra em centavos. */
  total: Cents;
  numParcelas: number;
  /** Mês da primeira parcela. */
  primeiroMes: YearMonth;
  categoria?: string;
  /** Cartão vinculado (opcional). */
  cartao?: string | null;
  /** Débito automático no cartão: entra no cálculo da fatura. */
  autoDebit?: boolean;
  /** Ajuste manual do valor de um mês específico. */
  overridePorMes?: Record<YearMonth, Cents>;
  /** Meses já pagos. `true` = pago por fora da fatura (manual/quitação) —
   *  deixa de contar no débito automático das faturas seguintes; `"fatura"` =
   *  quitado pela própria fatura do cartão — continua contando no cálculo,
   *  para o devido histórico não mudar. (Correção do double-charge do app
   *  antigo, mesma família dos bugs da seção 4.1.) */
  pagoPorMes: Record<YearMonth, boolean | "fatura">;
}
