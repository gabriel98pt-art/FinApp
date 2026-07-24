import type { ConfigConta } from "../types";
import { CATEGORIAS_DESPESA_PADRAO, FONTES_RECEITA_PADRAO } from "./categorias";

/** Config de uma conta nova. O RTDB remove objetos/arrays vazios — a
 *  normalização em cfgService garante estes campos sempre presentes. */
export const CONFIG_PADRAO: ConfigConta = {
  theme: "dark",
  currency: "EUR",
  showTvde: false,
  modoDiscreto: false,
  fontesReceita: FONTES_RECEITA_PADRAO,
  categoriasFixas: ["Casa", "Assinaturas", "Saúde", "Outros"],
  categoriasCorrentes: CATEGORIAS_DESPESA_PADRAO,
  contasCartoes: [],
  tipoCartao: {},
  // "Carregamento" fica de fora: cargas elétricas têm tracking próprio (kWh/local)
  categoriasVeiculo: ["Manutenção", "Seguro", "Portagens", "Revisão", "Outros"],
  metaPoupanca: 0,
  orcamentos: {},
  saldosIniciais: {},
  faturaManual: {},
  faturasPagas: {},
  locaisCarregamento: [],
};
