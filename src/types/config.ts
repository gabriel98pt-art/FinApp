import type { Cents, Currency, Theme, YearMonth } from "./common";
import type { PagamentosFatura } from "./fatura";

export type TipoCartao = "credit" | "debit";

/** Os 5 tokens de cor que se repetem no app inteiro e podem ser trocados em
 *  Definições. Fora daqui, cada categoria tem a sua própria cor. */
export type TokenCorApp = "blu" | "grn" | "red" | "ylw" | "pur";

export type CoresApp = Partial<Record<"dark" | "light", Partial<Record<TokenCorApp, string>>>>;

/** Como o Copiloto trata quem lhe pergunta. */
export type TomCopiloto = "direto" | "acolhedor";

/** Personalização do Copiloto — SÓ existe se a pessoa a tiver configurado de
 *  propósito. A ausência do campo é o estado normal, não um "por preencher":
 *  sem ele o Copiloto responde exactamente como sempre respondeu. */
export interface PreferenciasCopiloto {
  /** Como tratar a pessoa. Usa-se só a primeira palavra. */
  nome?: string;
  tom: TomCopiloto;
}

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
  /** Dia em que a semana começa nas grades de calendário e na visão "Semana"
   *  de Despesas/Veículo (0=domingo…6=sábado, como `Date#getDay()`). Um valor
   *  só, usado em todo canto que desenha semana — sem isto cada tela podia
   *  escolher um dia diferente por conta própria. */
  diaInicioSemana: number;

  /** Fontes de receita (antigo `src`). */
  fontesReceita: string[];
  /** Categorias de despesa — fixa e corrente juntas numa lista só (antes
   *  eram duas, `fcat`/`ccat` — a mesma categoria por nome já compartilhava
   *  ícone, cor e orçamento entre as duas, então a separação só duplicava a
   *  mesma categoria na tela de Definições sem separar nada de verdade). */
  categoriasDespesa: string[];
  /** Contas/cartões de pagamento, ex. 'AB Gold (C)' (antigo `pay`). */
  contasCartoes: string[];
  /** Tipo de cada cartão (crédito entra no fluxo de fatura, seção 4.1). */
  tipoCartao: Record<string, TipoCartao>;
  /** Dia do mês em que a fatura de cada cartão de crédito vence (1-31). O
   *  cálculo da fatura só conhece o MÊS; este dia serve para saber QUANDO ela
   *  se paga — e é também o vencimento das parcelas em débito automático
   *  nesse cartão, que saem com a fatura e não em data própria. */
  diaVencimentoFatura: Record<string, number>;
  /** Dia do mês em que a fatura de cada cartão de crédito FECHA (1-31). Sem
   *  entrada, o ciclo é o mês civil inteiro (último dia do mês) — o
   *  comportamento de sempre. Só compras feitas DEPOIS deste dia entram no
   *  ciclo do mês seguinte; até ele (inclusive), ficam no mês em que
   *  aconteceram. */
  diaFechamentoFatura: Record<string, number>;
  /** Categorias de despesa do veículo (antigo `vcat`). */
  categoriasVeiculo: string[];

  /** Ícone escolhido por categoria, indexado pelo NOME — compartilhado entre
   *  despesa fixa/corrente/veículo e fontes de receita (os nomes já se repetem
   *  entre as listas, ex. "Casa"). O valor é o id do ícone do `lucide-react`
   *  (ex. "utensils", "home", "car"), nunca o componente. Sem entrada =
   *  círculo neutro, sem ícone. */
  categoriaIcone: Record<string, string>;
  /** Cor escolhida por categoria, indexada pelo NOME (mesma regra do ícone).
   *  Sem entrada cai na cor semântica de `coresCategoria`, e depois no cinza. */
  categoriaCor: Record<string, string>;

  /** Quais 2 KPIs cada página mostra no mobile, por id de página (item 8).
   *  Sem entrada = os 2 primeiros da tela. No desktop aparecem todos. */
  kpisMobile: Record<string, [string, string]>;

  /** Meta de poupança mensal (antigo `sgoal`). */
  metaPoupanca: Cents;
  /** Teto de orçamento mensal por categoria (antigo `bud`, seção 4.8). */
  orcamentos: Record<string, Cents>;
  /** Quanto se planeia gastar por mês, no total. Recorrente como os tetos por
   *  categoria — "todo mês", e não um valor por mês (não há
   *  `orcamentoTotalMensal["2026-08"]`). Ausente = ainda não foi definido, que
   *  é o estado com que a tela Planejamento nasce. */
  orcamentoTotalMensal?: Cents;
  /** Saldo inicial por conta (antigo `bal`). */
  saldosIniciais: Record<string, Cents>;

  /** Override manual do valor da fatura por cartão/mês (antigo `fatManual`).
   *  Se existir, prevalece sobre o cálculo automático (seção 4.1). */
  faturaManual: Record<string, Record<YearMonth, Cents>>;
  /** Pagamentos de fatura por cartão/mês (antigo `fatPaid`). */
  faturasPagas: Record<string, Record<YearMonth, PagamentosFatura>>;

  /** Locais de carregamento elétrico salvos (antigo `locais`). */
  locaisCarregamento: string[];
  /** Quem intermedia os parcelamentos (Klarna, Scalapay…). Lista do próprio
   *  usuário, gerida na aba Parcelas — é conceito daquele domínio, como os
   *  locais de carregamento são do Veículo. */
  intermediadoresParcelamento: string[];

  /** Personalização do Copiloto. Ausente = sem personalização nenhuma, que é
   *  como toda a conta nasce e como fica se a pessoa a desligar. */
  copiloto?: PreferenciasCopiloto;

  /** Cores centrais escolhidas pelo usuário, POR TEMA — os tons de cada token
   *  já são diferentes entre claro e escuro, então um valor só não serviria
   *  aos dois. Sem entrada, vale o valor de `tokens.css`. */
  coresApp?: CoresApp;
}
