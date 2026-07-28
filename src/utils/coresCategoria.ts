// Cor por categoria de despesa — portado do app de referência (CAT_SEMANTIC +
// CCAT_PAL do financas.html): nome conhecido tem cor fixa (assim a mesma
// categoria mantém a cor entre meses e entre telas); categoria personalizada
// cai numa paleta ciclada pela ordem de aparição.

/** Cores fixas por nome. Cobre as categorias padrão do FinApp (correntes,
 *  fixas e veículo) mais os sinônimos mais comuns do app antigo. */
const COR_SEMANTICA: Record<string, string> = {
  // Alimentação
  Alimentação: "#f97316",
  Supermercado: "#f97316",
  Mercado: "#f97316",
  Restaurante: "#fb923c",
  // Casa / habitação
  Casa: "#a78bfa",
  Habitação: "#a78bfa",
  Renda: "#a78bfa",
  Aluguer: "#a78bfa",
  // Transporte
  Transporte: "#3b82f6",
  Transportes: "#3b82f6",
  Combustível: "#3b82f6",
  // Saúde
  Saúde: "#00d4e0",
  Farmácia: "#00d4e0",
  Médico: "#00d4e0",
  // Lazer
  Lazer: "#ec4899",
  Entretenimento: "#ec4899",
  Streaming: "#ec4899",
  // Compras / crédito
  Compras: "#f43f5e",
  Parcelas: "#f43f5e",
  // Veículo (fatia agregada do domínio Veículo)
  Veículo: "#84cc16",
  // "Despesa" e "Receita" não são categorias: entram aqui pra o botão
  // flutuante poder pegar carona no mesmo sistema de cor (semântica por
  // nome + override em cfg.categoriaCor). São os mesmos --red e --grn.
  Despesa: "#fb7185",
  Receita: "#4ade80",
  Manutenção: "#65a30d",
  Portagens: "#4d7c0f",
  Revisão: "#3f6212",
  // Assinaturas / tecnologia
  Assinaturas: "#06b6d4",
  Tecnologia: "#06b6d4",
  // Seguros
  Seguro: "#60a5fa",
  Seguros: "#60a5fa",
  // Outros
  Outros: "#94a3b8",
};

/** Cor fixa do nome, se houver — `undefined` para categoria personalizada.
 *  Usado pelo fallback do visual configurável (`categoriaVisual`). */
export function corSemanticaDaCategoria(categoria: string): string | undefined {
  return COR_SEMANTICA[categoria];
}

/** Paleta de reserva pra categorias personalizadas, ciclada por ordem de
 *  aparição (maior fatia primeiro). */
export const PALETA_FALLBACK = [
  "#ef4444",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#f472b6",
  "#f5a623",
];

/** Cor da categoria. `ordemFallback` é a posição dela entre as categorias SEM
 *  cor semântica (0, 1, 2…), pra duas personalizadas nunca saírem iguais. */
export function corDaCategoria(categoria: string, ordemFallback = 0): string {
  return (
    COR_SEMANTICA[categoria] ??
    PALETA_FALLBACK[
      ((ordemFallback % PALETA_FALLBACK.length) + PALETA_FALLBACK.length) % PALETA_FALLBACK.length
    ]
  );
}

/** Atribui cor a uma lista de categorias já ordenada, contando a ordem de
 *  aparição só das que caem no fallback. */
export function coresDasCategorias(categorias: string[]): string[] {
  let proxima = 0;
  return categorias.map((c) =>
    COR_SEMANTICA[c] !== undefined ? COR_SEMANTICA[c] : corDaCategoria(c, proxima++),
  );
}
