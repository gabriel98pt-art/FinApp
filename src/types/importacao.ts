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
}
