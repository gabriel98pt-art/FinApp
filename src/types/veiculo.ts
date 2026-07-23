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
}

/** Dados do veículo (antigo `veh`). As despesas variáveis do veículo
 *  (manutenção, seguro, portagens) vivem em `despesasCorrentes` com uma
 *  categoria de `categoriasVeiculo`. */
export interface DadosVeiculo {
  cargas: CargaEletrica[];
  /** Locais de carregamento usados (antigo `veh.lp`). */
  locais: string[];
  despesasFixas: DespesaFixa[];
  quilometragem: RegistroKm[];
}
