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
  // Saúde: era ciano (#00d4e0), depois verde (#16a34a) — cada um resolvia uma
  // colisão (a de ciano era com Transporte sob protanopia) mas o verde deixou
  // de valer: verde passou a ser reservado só pra Receita (pedido do
  // Gabriel). Magenta-rosa mantém a distância de Transporte sob qualquer
  // simulação de daltonismo (vermelho-azul é a separação mais robusta que
  // existe sob protanopia/deuteranopia) e não colide com mais nada da
  // paleta — conferido com as matrizes de Machado/Oliveira/Fialho 2009.
  Saúde: "#de55b6",
  Farmácia: "#de55b6",
  Médico: "#de55b6",
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
  // Manutenção/Portagens/Revisão: as 3 fixas de veículo que sobravam em verde
  // (nunca tiveram uma colisão documentada a resolver, eram só uma escolha
  // temática — "verde de estrada/oficina"). Verde saiu (só Receita agora),
  // então viram a MESMA família — roxo, em 3 tons — do mais claro ao mais
  // escuro, no lugar de verde claro→escuro: mesma lógica de antes (uma
  // família, separada por luminosidade), só a matiz muda. Reconferido sob
  // protanopia/deuteranopia/tritanopia contra Restaurante e TVDE (as duas
  // categorias de despesa mais prováveis de aparecer ao lado destas, pelo
  // domínio Veículo/TVDE): sem colisão em nenhum caso.
  Manutenção: "#cb5ed6",
  Portagens: "#914599",
  Revisão: "#723d77",
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

/** Paleta única de matizes — fonte de verdade tanto pra auto-atribuição
 *  (`corFallbackDaCategoria`, abaixo) quanto pro seletor manual (`CORES_
 *  CATEGORIA` em `constants/aparenciaCategoria.ts`, que acrescenta só os
 *  neutros por cima). Antes eram DUAS paletas divergentes (16 cores aqui, 24
 *  lá, sem relação uma com a outra) — cada uma cobria um conjunto diferente
 *  de matizes, então uma categoria automática e uma escolhida à mão nunca
 *  compartilhavam o mesmo "vocabulário" de cor. Unificadas nesta.
 *
 *  21 matizes, agrupadas por família (vermelhos, laranjas, amarelos… até
 *  magenta/rosa), do tom mais vivo/claro pro mais profundo dentro de cada
 *  família — pedido do Gabriel (26/08): a ordem antiga (3 fileiras de "vivas
 *  quente→fria" / "vivas de preenchimento" / "profundas", misturando
 *  matizes bem distantes lado a lado) lia como bagunçada. Agrupar por
 *  proximidade também é o que torna o novo indicador de "cor já em uso por
 *  outra categoria" (`SeletorCor`) fácil de escanear — famílias inteiras
 *  ficam juntas em vez de espalhadas pela grade.
 *
 *  3 cores novas na leva de 26/08: um amarelo mais vivo que o amarelo-ouro
 *  que já existia, um vermelho mais claro que o vermelho padrão ("sangue
 *  claro"), e (por um instante só) um verde vivo. NENHUMA das 18 cores
 *  originais mudou de valor — só de posição — então elas continuam com a
 *  verificação de protanopia/deuteranopia/tritanopia (Machado/Oliveira/
 *  Fialho 2009) já documentada nos commits anteriores. As cores novas NÃO
 *  passaram por essa simulação (fora do escopo destes pedidos); se alguma
 *  colisão aparecer na prática, é candidata a ajuste numa auditoria de
 *  Design & Cor futura.
 *
 *  O verde vivo (#22c55e) chegou a entrar reabrindo de propósito "verde só
 *  na categoria Receita" (ver `COR_SEMANTICA.Receita`) — pedido explícito do
 *  Gabriel na hora. Voltou atrás no MESMO dia: a regra é imutável mesmo, e
 *  ele pediu o verde de volta pra fora, junto com o marinho (#1e40af), sem
 *  motivo ligado a colisão — só preferência. Entram no lugar dos dois um
 *  marrom café (não tinha nenhum marrom "puro" na paleta, só terracota e
 *  mostarda, que são mais laranja/amarelo) e um índigo (preenche o vão real
 *  entre o azul e o violeta — não é só "azul mais escuro" como o marinho
 *  era, é matiz diferente). Guardado aqui pra não repetir a mesma pergunta
 *  duas vezes: o pedido de reabrir "verde geral" já foi feito e já foi
 *  revertido nesta mesma data. */
export const PALETA_CATEGORIA = [
  // Vermelhos
  "#ef4444", // vermelho
  "#f87171", // vermelho sangue claro
  "#9f1239", // vinho
  // Laranja / terracota
  "#f97316", // laranja
  "#c2410c", // terracota
  // Amarelo / mostarda / marrom
  "#facc15", // amarelo vivo
  "#eab308", // amarelo-ouro
  "#a16207", // mostarda
  "#92400e", // marrom café — novo, no lugar do verde vivo
  // Turquesa / petróleo
  "#00aeb2", // turquesa
  "#14b8a6", // esmeralda/petróleo claro
  "#0f766e", // petróleo
  // Ciano / azul-celeste
  "#06b6d4", // ciano
  "#0ea5e9", // azul-celeste
  // Azul / índigo
  "#3b82f6", // azul
  "#6366f1", // índigo — novo, no lugar do marinho
  // Violeta
  "#8b5cf6", // violeta
  "#bd4bd6", // magenta-violeta
  // Magenta / rosa / mauve
  "#d946ef", // magenta
  "#ec4899", // rosa
  "#a13957", // vinho-mauve
];

/** Nome antigo, mantido como alias: quem já lê `PALETA_FALLBACK` (o próprio
 *  `corFallbackDaCategoria`, os testes) continua a funcionar sem mudar
 *  chamada nenhuma. */
export const PALETA_FALLBACK = PALETA_CATEGORIA;

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
