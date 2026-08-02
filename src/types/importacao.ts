import type { Cents, Id, IsoDate } from "./common";

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

export interface ExistenteParaDedup {
  id: Id;
  data: IsoDate;
  valor: Cents;
  descricao: string;
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
 *  `transferencia_cartao` é dinheiro que veio de um cartão de CRÉDITO para uma
 *  conta: entra positivo no extrato e parece receita, mas não é dinheiro
 *  ganho — é dinheiro emprestado, que volta na fatura. Gravado como
 *  `Transferencia`, é o que faz a fatura do cartão contá-lo sozinha. */
export type DestinoLinha = "lancamento" | "carga" | "transferencia_cartao";

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
  /** Destino editável (começa em "carga" se a linha foi reconhecida como uma). */
  destino: DestinoLinha;
  /** Só com `destino === "carga"`: posto escolhido, dos cadastrados. */
  localCarga: string;
  /** Só com `destino === "carga"`: kWh como o usuário digita ("32,5"). O
   *  extrato não traz esta informação e o app não tem como a adivinhar. */
  kwhCarga: string;
  /** Só com `destino === "transferencia_cartao"`: cartão de crédito de onde o
   *  dinheiro saiu — é por ele que a fatura vai buscar este valor. */
  cartaoOrigem: string;
  /** Só com `destino === "transferencia_cartao"`: conta que recebeu. O extrato
   *  não diz de que conta é (a importação não tem esse conceito), e sem isto o
   *  saldo dessa conta ficaria sem o dinheiro que entrou. */
  contaDestino: string;
}
