import type { Cents, Id, IsoDate } from "./common";
import type { DespesaFixa } from "./lancamentos";

/** Sessão de carregamento elétrico (antigo `veh.cg`). */
export interface CargaEletrica {
  id: Id;
  data: IsoDate;
  kwh: number;
  /** Preço por kWh em centavos. */
  precoKwh: Cents;
  custo: Cents;
  local: string;
  sessao?: string;
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
  nota?: string;
}

/** Dados do veículo (antigo `veh`). Locais de carregamento salvos vivem em
 *  `cfg.locaisCarregamento`, não aqui (correção de um mapeamento errado do
 *  Marco 1 — `veh.lp` no app de referência são despesas, não locais). */
export interface DadosVeiculo {
  cargas: CargaEletrica[];
  despesas: DespesaVeiculo[];
  despesasFixas: DespesaFixa[];
  quilometragem: RegistroKm[];
}
