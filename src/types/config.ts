import type { Cents, Currency, Theme, YearMonth } from "./common";
import type { PagamentosFatura } from "./fatura";

export type TipoCartao = "credit" | "debit";

/** Configuração por conta (antigo `S.cfg`). */
export interface ConfigConta {
  theme: Theme;
  /** Só o símbolo muda — a formatação `1.234,56` é igual para todas (seção 4.5). */
  currency: Currency;
  /** Módulo TVDE é opt-in por conta; convidados nascem com ele desligado. */
  showTvde: boolean;
  /** Blur visual em elementos sensíveis (poupança, orçamento, resumo anual,
   *  breakdown por categoria) — seção 4.6. Não esconde o resto da navegação. */
  modoDiscreto: boolean;

  /** Fontes de receita (antigo `src`). */
  fontesReceita: string[];
  /** Categorias de despesa fixa (antigo `fcat`). */
  categoriasFixas: string[];
  /** Categorias de despesa corrente (antigo `ccat`). */
  categoriasCorrentes: string[];
  /** Contas/cartões de pagamento, ex. 'AB Gold (C)' (antigo `pay`). */
  contasCartoes: string[];
  /** Tipo de cada cartão (crédito entra no fluxo de fatura, seção 4.1). */
  tipoCartao: Record<string, TipoCartao>;
  /** Categorias de despesa do veículo (antigo `vcat`). */
  categoriasVeiculo: string[];

  /** Emoji escolhido por categoria, indexado pelo NOME — compartilhado entre
   *  despesa fixa/corrente/veículo e fontes de receita (os nomes já se repetem
   *  entre as listas, ex. "Casa"). Sem entrada = círculo neutro, sem emoji. */
  categoriaEmoji: Record<string, string>;
  /** Cor escolhida por categoria, indexada pelo NOME (mesma regra do emoji).
   *  Sem entrada cai na cor semântica de `coresCategoria`, e depois no cinza. */
  categoriaCor: Record<string, string>;

  /** Quais 2 KPIs cada página mostra no mobile, por id de página (item 8).
   *  Sem entrada = os 2 primeiros da tela. No desktop aparecem todos. */
  kpisMobile: Record<string, [string, string]>;

  /** Meta de poupança mensal (antigo `sgoal`). */
  metaPoupanca: Cents;
  /** Teto de orçamento mensal por categoria (antigo `bud`, seção 4.8). */
  orcamentos: Record<string, Cents>;
  /** Saldo inicial por conta (antigo `bal`). */
  saldosIniciais: Record<string, Cents>;

  /** Override manual do valor da fatura por cartão/mês (antigo `fatManual`).
   *  Se existir, prevalece sobre o cálculo automático (seção 4.1). */
  faturaManual: Record<string, Record<YearMonth, Cents>>;
  /** Pagamentos de fatura por cartão/mês (antigo `fatPaid`). */
  faturasPagas: Record<string, Record<YearMonth, PagamentosFatura>>;

  /** Locais de carregamento elétrico salvos (antigo `locais`). */
  locaisCarregamento: string[];
}
