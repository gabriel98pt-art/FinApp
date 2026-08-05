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
  /** Na prática só 'recon' aparece aqui — um ajuste de reconciliação bancária
   *  para cima. Fica fora dos totais de receita (`receitasNosTotais`) mas
   *  continua na lista, tal como o lado da despesa. O tipo é partilhado com
   *  `DespesaCorrente` em vez de duplicado. */
  origem?: OrigemLancamento;
  /** Descrição livre, separada do nome curto em `descricao`. */
  nota?: string;
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
  /** Dia do mês do vencimento (1-31), usado pra marcar no Calendário. */
  diaVencimento?: number;
  /** Anotação do usuário: "isto sai do cartão sozinho". SÓ INFORMATIVO —
   *  ao contrário do `autoDebit` da Parcela, este NÃO entra em `utils/fatura.ts`
   *  nem em cálculo nenhum. Uma fixa já entra na fatura sempre que `contaCartao`
   *  é um cartão de crédito; se este campo passasse a filtrar isso, quem já tem
   *  fixa em cartão hoje (portanto `undefined`) veria o valor sair da fatura sem
   *  ter mexido em nada. Vale como uma nota visível, nada mais. */
  autoDebit?: boolean;
  /** Descrição livre, separada do nome curto em `descricao`. */
  nota?: string;
}

/** Despesa corrente/variável (antigo `dc`). */
export interface DespesaCorrente extends LancamentoBase {
  categoria: string;
  contaCartao?: string;
  origem?: OrigemLancamento;
  /** Nota livre (ex. "2ª de 5" numa parcela, "Ref. julho" num pagamento de fatura). */
  nota?: string;
  /** Vínculo com a parcela que gerou este lançamento (antigo `_pid`). */
  parcelaId?: Id;
  /** Mês da parcela dentro do plano (antigo `_pm`); 'quit' = quitação antecipada. */
  parcelaMes?: YearMonth | "quit";
  /** Num pagamento de fatura (origem 'fat'): qual cartão/mês ele quita. */
  fatCartao?: string;
  fatMes?: YearMonth;
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
  /** Descrição livre, separada do nome curto em `descricao`. */
  nota?: string;
}
