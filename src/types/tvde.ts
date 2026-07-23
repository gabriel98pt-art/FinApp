import type { Cents, Id, IsoDate, YearMonth } from "./common";

/** Semana de trabalho TVDE (antigo `tvde.weeks`).
 *  ATENÇÃO (seção 4.4): as fórmulas vêm de uma planilha original e não podem
 *  mudar de comportamento — os campos de valores serão fixados no marco que
 *  portar o módulo, validados contra a planilha. Moeda sempre EUR. */
export interface SemanaTvde {
  id: Id;
  inicio: IsoDate;
  fim: IsoDate;
  /** Ganhos brutos por plataforma (ex. 'uber', 'bolt'). */
  ganhos: Record<string, Cents>;
  gorjetas?: Cents;
  portagens?: Cents;
  /** Semana "teste": conta para dinheiro real (mês, período, receita, Segurança
   *  Social) mas some de TODO indicador de performance — split intencional. */
  teste: boolean;
}

/** Segurança Social — rastreada por mês de PAGAMENTO, não por período de
 *  faturamento (desfasamento trimestral real, seção 4.4). */
export interface SegurancaSocialTvde {
  id: Id;
  mesPagamento: YearMonth;
  valor: Cents;
  trimestreReferencia?: string;
}

export interface DespesaTvde {
  id: Id;
  data: IsoDate;
  descricao: string;
  valor: Cents;
  categoria?: string;
}

export interface LancamentoTvde {
  id: Id;
  data: IsoDate;
  descricao: string;
  valor: Cents;
  tipo: "receita" | "despesa";
}

export interface ConfigTvde {
  metaSemanal?: Cents;
}

/** Módulo TVDE, completamente autocontido (antigo `S.tvde`). */
export interface DadosTvde {
  semanas: SemanaTvde[];
  segurancaSocial: SegurancaSocialTvde[];
  despesas: DespesaTvde[];
  lancamentos: LancamentoTvde[];
  cfg: ConfigTvde;
}
