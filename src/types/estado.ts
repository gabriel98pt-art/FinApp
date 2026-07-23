import type { ConfigConta } from "./config";
import type { DespesaCorrente, DespesaFixa, Receita, Transferencia } from "./lancamentos";
import type { Parcela } from "./parcela";
import type { EventoCalendario, Fundo } from "./planeamento";
import type { DadosVeiculo } from "./veiculo";
import type { DadosTvde } from "./tvde";

/** Estado financeiro completo de uma conta — o antigo objeto global `S`
 *  (seção 5), traduzido para forma tipada. Nas stores, será dividido por
 *  domínio; este agregado existe para persistência/backup/migração. */
export interface EstadoConta {
  cfg: ConfigConta;
  receitas: Receita[];
  despesasFixas: DespesaFixa[];
  despesasCorrentes: DespesaCorrente[];
  veiculo: DadosVeiculo;
  parcelas: Parcela[];
  eventos: EventoCalendario[];
  fundos: Fundo[];
  transferencias: Transferencia[];
  tvde: DadosTvde;
}
