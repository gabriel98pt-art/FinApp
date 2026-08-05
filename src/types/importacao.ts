import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Uma linha crua do extrato, já parseada (CSV ou texto colado). */
export interface LinhaExtrato {
  data: IsoDate;
  descricao: string;
  /** Positivo = crédito (entrada), negativo = débito (saída). */
  valor: Cents;
}

/** Destino de um lançamento classificado. `fatura` e `transferencia` viram
 *  despesa corrente com categoria própria — o app ainda não tem os domínios
 *  de fatura-por-reconciliação/transferências para atribuir automaticamente
 *  um lançamento bancário a um cartão/conta específica sem arriscar corromper
 *  o cálculo de fatura (seção 4.1); a reconciliação fina fica pra tela Cartões. */
export type TipoClassificado = "receita" | "despesa" | "fatura" | "transferencia";

export type Confianca = "high" | "medium" | "low";

export interface Classificacao {
  tipo: TipoClassificado;
  categoria: string | null;
  incerto: boolean;
  confianca: Confianca;
  /** Explicação legível de por que essa classificação foi escolhida. */
  motivo: string;
  cartaoSugerido?: string | null;
}

export type StatusDuplicata = "exact_duplicate" | "duplicate" | "possible" | "new";

/** De que domínio veio o registo que bateu — sem isto sabe-se QUAL registo é,
 *  mas não onde ele mora, e não há como lhe mexer a partir da revisão. */
export type OrigemExistente =
  "receita" | "despesa" | "carga" | "despesaVeiculo" | "transferencia" | "despesaFixa";

export interface ExistenteParaDedup {
  id: Id;
  data: IsoDate;
  valor: Cents;
  descricao: string;
  origem: OrigemExistente;
  /** Só em `despesaFixa`: o mês que estava marcado como pago. Apagar aqui é
   *  desmarcar esse mês, nunca apagar a despesa recorrente inteira. */
  mes?: YearMonth;
}

export interface ResultadoDuplicata {
  status: StatusDuplicata;
  confianca: Confianca | null;
  correspondencia: ExistenteParaDedup | null;
  score: number;
  motivos: string[];
}

/** Decisão sugerida pra cada linha, usada para agrupar a UI. */
export type DecisaoLinha = "auto_classificada" | "nova" | "duplicata_provavel" | "revisao";

/** Onde a linha vai parar ao confirmar. `lancamento` é o caminho de sempre —
 *  receita ou despesa corrente, conforme `classificacao.tipo`. Os outros dois
 *  gravam noutros domínios e por isso não cabiam em `TipoClassificado`: são
 *  escolha do usuário na revisão, não resultado da classificação.
 *
 *  `carga` grava uma recarga elétrica no veículo.
 *
 *  `pagamento_fatura` é o pagamento da fatura do cartão de crédito: como
 *  despesa comum a conta ficava certa mas a aba Cartões nunca sabia que a
 *  fatura tinha sido paga. Vai por `pagarFatura`, o mesmo caminho do
 *  pagamento registado à mão.
 *
 *  `transferencia_cartao` é dinheiro que veio de outra conta ou cartão do
 *  próprio usuário: entra positivo no extrato e parece receita, mas não é
 *  dinheiro ganho — só mudou de sítio. Gravado como `Transferencia`; vindo de
 *  um cartão de crédito, é isso que faz a fatura contá-lo sozinha. */
export type DestinoLinha = "lancamento" | "carga" | "transferencia_cartao" | "pagamento_fatura";

export interface LinhaAnalisada {
  id: number;
  data: IsoDate;
  descricao: string;
  valor: Cents;
  classificacao: Classificacao;
  duplicata: ResultadoDuplicata;
  decisao: DecisaoLinha;
  /** Ação sugerida — o usuário pode mudar antes de confirmar. */
  acao: "import" | "skip";
  /** Categoria editável (começa na sugestão da classificação). */
  categoriaEscolhida: string;
  /** Receita ou despesa, à escolha do usuário — começa no que a classificação
   *  decidiu, mas manda sobre ela. Sem isto, um classificador que errasse o
   *  lado não tinha correção possível: o tipo não é editável depois de gravado
   *  (receitas e despesas são coleções separadas), e a revisão é a única
   *  oportunidade. `fatura` e `transferencia` continuam a começar em despesa,
   *  como sempre foi. */
  tipoEscolhido: "receita" | "despesa";
  /** Destino editável (começa em "carga" se a linha foi reconhecida como uma). */
  destino: DestinoLinha;
  /** Só com `destino === "lancamento"`: conta ou cartão de pagamento, à
   *  escolha do usuário — começa vazio (nenhum). Sendo cartão de crédito,
   *  entra automaticamente na fatura dele (`utils/fatura.ts`); sendo conta
   *  comum, fica só como registo de onde saiu o dinheiro. Sem isto, tudo o
   *  que vinha do extrato ficava fora de qualquer fatura, mesmo quando era o
   *  extrato de um cartão. */
  contaEscolhida: string;
  /** Só com `destino === "carga"`: posto escolhido, dos cadastrados. */
  localCarga: string;
  /** Só com `destino === "carga"`: kWh como o usuário digita ("32,5"). O
   *  extrato não traz esta informação e o app não tem como a adivinhar. */
  kwhCarga: string;
  /** De onde o dinheiro saiu. Serve os dois destinos que o perguntam, porque
   *  o papel é o mesmo: na transferência é a conta de origem (sendo cartão de
   *  crédito, é por aqui que a fatura vai buscar o valor); no pagamento de
   *  fatura é a conta que pagou. */
  contaOrigem: string;
  /** Só com `destino === "transferencia_cartao"`: conta que recebeu. O extrato
   *  não diz de que conta é (a importação não tem esse conceito), e sem isto o
   *  saldo dessa conta ficaria sem o dinheiro que entrou. */
  contaDestino: string;
  /** Só com `destino === "pagamento_fatura"`: cartão cuja fatura foi paga. */
  fatCartaoEscolhido: string;
  /** Só com `destino === "pagamento_fatura"`: mês da fatura. Começa no mês da
   *  própria linha, que é o palpite razoável, e é editável — quem paga a 2 de
   *  agosto a fatura de julho corrige aqui. */
  fatMesEscolhido: string;
  /** Numa transferência, o lançamento de SINAL CONTRÁRIO que parece ser a
   *  outra ponta do mesmo dinheiro, já registado. `null` quando não há nada
   *  parecido — ou quando a linha não é transferência. É um aviso para o
   *  usuário reconhecer o movimento, não um impedimento. */
  outraPonta: ResultadoDuplicata | null;
}
