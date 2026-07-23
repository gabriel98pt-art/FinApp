import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Um pagamento (total ou parcial) de fatura de cartão. */
export interface PagamentoFatura {
  id: Id;
  data: IsoDate;
  valor: Cents;
}

/** Lista de pagamentos de um cartão num mês. Registros legados no formato
 *  "pagamento único" devem ser lidos como lista de 1 item (seção 4.1). */
export interface PagamentosFatura {
  pagamentos: PagamentoFatura[];
}

/** Visão calculada de uma fatura de cartão num mês — nunca persistida,
 *  sempre derivada (seção 4.1). */
export interface FaturaCalculada {
  cartao: string;
  mes: YearMonth;
  /** Soma automática do ciclo (fixas + veículo + correntes sem `_src:'fat'` +
   *  parcelas + transferências de saída). */
  devidoAutomatico: Cents;
  /** Override manual, se existir prevalece sobre o automático. */
  overrideManual: Cents | null;
  /** Valor efetivamente devido (override ?? automático). */
  devido: Cents;
  /** Total já pago (soma dos pagamentos parciais). */
  pago: Cents;
  /** Sempre `max(0, devido - pago)`, nunca negativo. */
  restante: Cents;
}
