import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Origem de um lançamento gerado por outro fluxo (antigo `_src`):
 *  - 'parc': gerado por uma parcela mensal (seção 4.3)
 *  - 'fat':  registro de pagamento de fatura (excluído do cálculo da própria
 *            fatura para evitar contagem circular, seção 4.1)
 *  - 'fixa': gerado ao marcar uma despesa fixa como paga (01/09/2026) — mesmo
 *            papel do 'parc' para parcelas: carrega a DATA REAL do pagamento,
 *            que `pagoPorMes` (um booleano sem data) nunca guardou. Existe
 *            pra alimentar o total de fluxo de caixa do Início
 *            (`despesaRegistradaMes`) sem duplicar o valor que já entra pela
 *            via de cronograma (`contribuicaoFixasMes`) — por isso também
 *            excluído de `despesasNosTotais`, igual a 'parc'.
 *  - 'recon': criado pela reconciliação da importação bancária
 *  - 'reemb': dinheiro devolvido sobre uma despesa já lançada (o jantar em
 *             grupo que os amigos pagam de volta). Guardado como despesa de
 *             valor NEGATIVO na MESMA categoria da original, e não como
 *             receita: dinheiro que volta para quem o adiantou não é receita
 *             nova, e pô-lo do outro lado inflava as Receitas com o que já era
 *             dele. Na categoria, o negativo neta sozinho — o Restaurante
 *             mostra os 25 € que ficaram, não 100 nem dois números soltos.
 *             (Mesmo padrão do YNAB para estornos e divisão de contas.)
 *
 *             Ao contrário dos outros, 'reemb' NÃO é excluído dos totais
 *             (`despesasNosTotais`): ele existe justamente para os reduzir. */
export type OrigemLancamento = "parc" | "fat" | "fixa" | "recon" | "reemb";

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
  /** "Isto sai do cartão sozinho". NÃO filtra o cálculo da fatura: uma fixa
   *  entra nela sempre que `contaCartao` é cartão de crédito, e passar a exigir
   *  este campo tirava da fatura o valor de quem já tem fixa em cartão hoje
   *  (portanto `undefined`) sem ter mexido em nada.
   *
   *  O que ele decide é o contrário — se conta como PAGA sem ninguém a marcar
   *  (`fixaEfetivamentePaga`, utils/fatura.ts). Uma fixa em débito automático
   *  que ninguém marca à mão nunca aparecia como paga, e sumia do extrato e dos
   *  totais do mês corrente. */
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
  /** Vínculo com a despesa fixa que gerou este lançamento (origem 'fixa',
   *  01/09/2026) — mesmo par que `parcelaId`/`parcelaMes`, um mês por vez. */
  fixaId?: Id;
  fixaMes?: YearMonth;
  /** Num reembolso (origem 'reemb'): a despesa que este valor reduz.
   *
   *  OPCIONAL de propósito, ao contrário do `parcelaId`: às vezes o reembolso
   *  é uma correção solta — um estorno que chega semanas depois, de uma compra
   *  que já ninguém identifica. Obrigar a escolher uma origem faria a pessoa
   *  inventar uma, e um vínculo inventado é pior do que vínculo nenhum: ele
   *  aparece na linha da despesa errada a dizer que ela foi reembolsada.
   *
   *  Quando existe, a linha da despesa original passa a mostrar o líquido. */
  reembolsoDeId?: Id;
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
