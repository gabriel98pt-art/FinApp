// Listas padrão de uma conta nova — passam a ser configuráveis (Definições)
// quando a store de configuração chegar (seção 5: cfg.src / cfg.ccat).

export const FONTES_RECEITA_PADRAO = ["Salário", "TVDE", "Extra", "Outros"];

/** Uma lista só para despesa fixa e corrente (ver `categoriasDespesa` em
 *  types/config.ts) — antes eram duas listas separadas, e "Assinaturas"
 *  vinha só na dos fixos. */
export const CATEGORIAS_DESPESA_PADRAO = [
  "Alimentação",
  "Casa",
  "Transporte",
  "Saúde",
  "Lazer",
  "Compras",
  "Assinaturas",
  "Outros",
];
