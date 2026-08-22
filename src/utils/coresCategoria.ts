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
  // Terracota, não um segundo laranja: era byte-a-byte igual ao "#fb923c" do
  // TVDE (achado da auditoria de Design & Cor — as duas categorias podem
  // aparecer juntas no mesmo donut se a conta tiver despesas pessoais e de
  // TVDE no mesmo mês) e ficava perto demais de Alimentação sob
  // deuteranopia. Reaproveita o terracota já usado na paleta de
  // personalização (constants/aparenciaCategoria.ts).
  Restaurante: "#c2410c",
  // Casa / habitação
  Casa: "#a78bfa",
  Habitação: "#a78bfa",
  Renda: "#a78bfa",
  Aluguer: "#a78bfa",
  // Transporte
  Transporte: "#3b82f6",
  Transportes: "#3b82f6",
  Combustível: "#3b82f6",
  // Saúde: era ciano (#00d4e0) — sob protanopia caía quase exatamente sobre
  // Transporte (#3b82f6): as duas colapsavam pra praticamente a mesma cor
  // (achado da auditoria). Verde também é uma associação comum pra
  // saúde/farmácia, então a mudança não perde legibilidade semântica.
  Saúde: "#16a34a",
  Farmácia: "#16a34a",
  Médico: "#16a34a",
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
  // Mesma ideia para o TVDE: é o laranja `--lrj`, o mesmo do card "Lucro
  // total" dessa aba — o botão flutuante chega já com a cor da tela.
  TVDE: "#fb923c",
  Manutenção: "#65a30d",
  Portagens: "#4d7c0f",
  Revisão: "#3f6212",
  // Assinaturas / tecnologia
  Assinaturas: "#06b6d4",
  Tecnologia: "#06b6d4",
  // Seguro: era azul claro (#60a5fa), indistinguível de Casa (#a78bfa) sob
  // deuteranopia — o achado principal da auditoria de Design & Cor. Petróleo
  // escuro em vez de mais um tom de azul/roxo — já usado como um dos "tons
  // profundos" da paleta de personalização.
  Seguro: "#0f766e",
  Seguros: "#0f766e",
  // Outros
  Outros: "#94a3b8",
};

/** Cor fixa do nome, se houver — `undefined` para categoria personalizada.
 *  Usado pelo fallback do visual configurável (`categoriaVisual`). */
export function corSemanticaDaCategoria(categoria: string): string | undefined {
  return COR_SEMANTICA[categoria];
}

/** Paleta de reserva pra categorias personalizadas — a escolha dentro dela é
 *  pelo NOME (ver `corFallbackDaCategoria`). */
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

/** Índice estável na paleta, pelo nome — duas categorias sem cor escolhida
 *  ficam quase sempre distintas, e a MESMA categoria sai sempre com a mesma
 *  cor em qualquer tela, ao contrário de depender da posição numa lista. */
function hashCategoria(nome: string): number {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Cor de reserva de uma categoria sem nome semântico nem escolha do usuário —
 *  determinística, não depende de posição em lista nenhuma.
 *
 *  Não é chamada diretamente por tela nenhuma: quem decide cor de categoria é
 *  sempre `corDaCategoriaVisual` (utils/categoriaVisual.ts), que respeita
 *  primeiro a escolha do usuário. */
export function corFallbackDaCategoria(categoria: string): string {
  return PALETA_FALLBACK[hashCategoria(categoria) % PALETA_FALLBACK.length];
}
