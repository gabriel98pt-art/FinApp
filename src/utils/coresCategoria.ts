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
  // Veículo (fatia agregada do domínio Veículo). Era #84cc16 (verde-lima,
  // H≈131°) — a 21° de Receita (H≈152°) no OKLCH, a menor distância
  // perceptual (OKLab) de toda a paleta (0,080) depois das que já eram
  // aceites de propósito (Saúde/Manutenção, Alimentação/TVDE). No donut de
  // categorias isso é tolerável (nome no rótulo, separador entre fatias —
  // ver comentário da paleta abaixo); no seletor de 3 estados do Registro
  // Rápido (Despesa/Receita/Veículo, `RegistroRapido.tsx`), onde as três
  // cores aparecem sozinhas lado a lado sem rótulo por perto, as duas liam
  // como "dois verdes" (achado da auditoria de Design & Cor, 22/08). Verde-
  // azulado abre a distância de Receita sem invadir Transporte/Casa/Seguro/
  // Assinaturas nem colidir pior que os pares já aceites sob protanopia/
  // deuteranopia/tritanopia (checado com as matrizes de Machado/Oliveira/
  // Fialho 2009 contra as 17 cores fixas + a paleta de fallback).
  Veículo: "#14b8a6",
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
 *  pelo NOME (ver `corFallbackDaCategoria`).
 *
 *  16 matizes (era 12), espaçadas em 22,5° ao redor da roda de cor, com
 *  luminosidade alternada entre vizinhas (mesmo truque da paleta de
 *  personalização em `constants/aparenciaCategoria.ts`: duas matizes perto
 *  uma da outra ficam mais fáceis de separar quando uma é mais clara e a
 *  outra mais escura). Nenhuma repete uma cor já fixa por nome em
 *  `COR_SEMANTICA` — pra uma categoria automática nunca cair em cima de
 *  "Alimentação" ou "Casa" no mesmo donut.
 *
 *  Verificado sob simulação de protanopia/deuteranopia/tritanopia: mesmo
 *  assim, 8 dos 120 pares ficam pouco distinguíveis nalgum tipo de
 *  daltonismo — com 16 cores simultâneas não dá pra evitar por completo (a
 *  própria ciência de cor trata isso como praticamente impossível além de
 *  3-4 cores ao mesmo tempo). O separador entre fatias do donut e o nome em
 *  texto na legenda continuam sendo a defesa real contra esse resíduo, não
 *  o matiz sozinho.
 *
 *  Mudar esta lista muda a cor AUTOMÁTICA de toda categoria personalizada
 *  sem cor escolhida à mão — é o ponto: quem tem muitas categorias passa a
 *  ter mais opções distintas entre elas. Não afeta ninguém que já escolheu
 *  uma cor manualmente (isso fica em `cfg.categoriaCor`, à parte). */
export const PALETA_FALLBACK = [
  "#e23636",
  "#b45922",
  "#e2b736",
  "#a2b422",
  "#8ce236",
  "#34b422",
  "#36e261",
  "#22b47d",
  "#36e2e2",
  "#227db4",
  "#3661e2",
  "#3422b4",
  "#8c36e2",
  "#a222b4",
  "#e236b7",
  "#b42259",
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
