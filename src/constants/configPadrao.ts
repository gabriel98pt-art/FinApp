import type { ConfigConta } from "../types";
import { CATEGORIAS_DESPESA_PADRAO, FONTES_RECEITA_PADRAO } from "./categorias";

/** Config de uma conta nova. O RTDB remove objetos/arrays vazios — a
 *  normalização em cfgService garante estes campos sempre presentes. */
export const CONFIG_PADRAO: ConfigConta = {
  theme: "dark",
  currency: "EUR",
  showTvde: false,
  // Ligado por omissão (e não `false` como o TVDE): o módulo Veículo já existe
  // há muito, e como `normalizarConfig` só repõe defaults para campos ausentes,
  // qualquer conta anterior a este interruptor continua a ver a aba.
  showVeiculo: true,
  modoDiscreto: false,
  diaInicioSemana: 1, // segunda-feira
  fontesReceita: FONTES_RECEITA_PADRAO,
  categoriasDespesa: CATEGORIAS_DESPESA_PADRAO,
  instituicoes: [],
  contasCartoes: [],
  tipoCartao: {},
  diaVencimentoFatura: {},
  diaFechamentoFatura: {},
  // "Carregamento" fica de fora: cargas elétricas têm tracking próprio (kWh/local)
  categoriasVeiculo: ["Manutenção", "Seguro", "Portagens", "Revisão", "Outros"],
  tipoVeiculo: "eletrico",
  categoriaIcone: {},
  categoriaCor: {},
  kpisMobile: {},
  metaPoupanca: 0,
  orcamentos: {},
  saldosIniciais: {},
  faturaManual: {},
  faturasPagas: {},
  locaisCarregamento: [],
  intermediadoresParcelamento: [],
};
