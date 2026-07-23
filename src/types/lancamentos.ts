import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Origem de um lançamento gerado por outro fluxo (antigo `_src`):
 *  - 'parc': gerado por uma parcela mensal (seção 4.3)
 *  - 'fat':  registro de pagamento de fatura (excluído do cálculo da própria
 *            fatura para evitar contagem circular, seção 4.1)
 *  - 'recon': criado pela reconciliação da importação bancária */
export type OrigemLancamento = "parc" | "fat" | "recon";

interface LancamentoBase {
  id: Id;
  descricao: string;
  valor: Cents;
  data: IsoDate;
}

/** Receita pontual ou recorrente (antigo `rec`). */
export interface Receita extends LancamentoBase {
  fonte: string;
  conta?: string;
  recorrente?: boolean;
}

/** Despesa fixa mensal (antigo `df`). Ativa entre `inicio` e `fim`;
 *  o pago/pendente é controlado por mês. */
export interface DespesaFixa {
  id: Id;
  descricao: string;
  valor: Cents;
  categoria: string;
  /** Conta ou cartão de pagamento — se for cartão de crédito, entra na fatura. */
  contaCartao?: string;
  inicio?: YearMonth;
  fim?: YearMonth | null;
  pagoPorMes: Record<YearMonth, boolean>;
}

/** Despesa corrente/variável (antigo `dc`). */
export interface DespesaCorrente extends LancamentoBase {
  categoria: string;
  contaCartao?: string;
  origem?: OrigemLancamento;
  /** Vínculo com a parcela que gerou este lançamento (antigo `_pid`). */
  parcelaId?: Id;
  /** Mês da parcela dentro do plano (antigo `_pm`). */
  parcelaMes?: YearMonth;
  /** Id do backup legado "Quick€" para deduplicação na importação (antigo `_qfId`). */
  qfId?: string;
}

/** Transferência entre contas (antigo `trf`). Saídas contra cartão de crédito
 *  entram no cálculo da fatura (seção 4.1). */
export interface Transferencia {
  id: Id;
  data: IsoDate;
  de: string;
  para: string;
  valor: Cents;
  descricao?: string;
}
