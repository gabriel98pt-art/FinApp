import type { Cents, Id, IsoDate, YearMonth } from "./common";
import type { DespesaFixa, OrigemLancamento } from "./lancamentos";

/** Motorização do veículo — decide que campos a aba de abastecimento mostra
 *  (item B1). Sem escolha explícita nas configurações, `"eletrico"` é o
 *  default: é o que o app já assumia implicitamente antes deste campo
 *  existir, então dados/contas antigas continuam a funcionar sem migração. */
export type TipoVeiculo = "eletrico" | "combustao" | "hibrido";

/** Um abastecimento — elétrico (kWh) ou a combustível (litros). Um veículo
 *  híbrido regista cada abastecimento como UM dos dois, nunca os dois ao
 *  mesmo tempo (encheu o depósito OU carregou a bateria numa sessão); por
 *  isso os dois pares de campos são opcionais em vez de o tipo decidir a
 *  forma do objeto inteiro — mais simples que duas interfaces + union, e o
 *  histórico de um veículo elétrico/combustão puro só usa sempre o mesmo par.
 *
 *  Nome genérico (era `CargaEletrica`, "sessão de carregamento") porque
 *  passou a cobrir também combustível — os dados antigos, todos elétricos,
 *  continuam válidos: tinham `kwh`/`precoKwh` preenchidos, que continuam
 *  presentes, só deixaram de ser obrigatórios. */
export interface Abastecimento {
  id: Id;
  data: IsoDate;
  /** Presente num abastecimento elétrico (veículo elétrico, ou híbrido
   *  carregando a bateria). */
  kwh?: number;
  /** Preço por kWh em centavos. */
  precoKwh?: Cents;
  /** Presente num abastecimento a combustível (veículo a combustão, ou
   *  híbrido enchendo o depósito). */
  litros?: number;
  /** Preço por litro em centavos. */
  precoLitro?: Cents;
  custo: Cents;
  local: string;
  sessao?: string;
  /** Conta/cartão que pagou — se for crédito, entra na fatura do ciclo. */
  contaCartao?: string;
  /** Descrição livre, separada do nome curto em `local`. */
  nota?: string;
}

/** Registro de quilometragem (antigo `veh.km`). */
export interface RegistroKm {
  id: Id;
  data: IsoDate;
  km: number;
  nota?: string;
}

/** Despesa variável do veículo — manutenção, seguro, portagens, revisão etc.
 *  (antigo `veh.lp`; sempre "realizada" no momento do registro, como uma
 *  despesa corrente comum — sem estado pago/pendente). */
export interface DespesaVeiculo {
  id: Id;
  data: IsoDate;
  valor: Cents;
  categoria: string;
  /** Nome curto do lançamento — o mesmo par `descricao` + `nota` das despesas
   *  correntes. Opcional de propósito: até existir este campo a despesa do
   *  veículo só tinha categoria + nota, e quem mostra o título continua a cair
   *  na `nota` e depois na `categoria` quando ele falta, para que os registos
   *  antigos sigam a aparecer exatamente como antes (migração implícita). */
  descricao?: string;
  /** Conta/cartão que pagou — se for crédito, entra na fatura do ciclo. */
  contaCartao?: string;
  nota?: string;
  /** Presente só no espelho gerado ao marcar uma despesa fixa do veículo como
   *  paga (origem 'fixa', 01/09/2026) — mesmo papel do `origem`/`fixaId`/
   *  `fixaMes` de `DespesaCorrente`. Ausente em toda despesa variável comum. */
  origem?: OrigemLancamento;
  fixaId?: Id;
  fixaMes?: YearMonth;
}

/** Dados do veículo (antigo `veh`). Locais de carregamento salvos vivem em
 *  `cfg.locaisCarregamento`, não aqui (correção de um mapeamento errado do
 *  Marco 1 — `veh.lp` no app de referência são despesas, não locais). */
export interface DadosVeiculo {
  cargas: Abastecimento[];
  despesas: DespesaVeiculo[];
  despesasFixas: DespesaFixa[];
  quilometragem: RegistroKm[];
}
