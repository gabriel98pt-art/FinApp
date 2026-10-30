// Rótulos dos KPIs de cada página, na ordem em que aparecem na tela — a fonte
// da escolha do "Número em destaque" em Definições.
//
// Os rótulos aqui TÊM que bater com os `rotulo` (ou `chave`) passados ao
// KpiCard em cada página: é por esse texto que a escolha do usuário é casada.
// Ao renomear um KPI numa tela há duas saídas: renomear aqui também — e quem
// já tinha escolhido esse KPI volta ao primeiro da página —, ou manter a chave e
// dar o texto novo em `textos`, passando a chave antiga em `chave` no KpiCard.
// A segunda é a preferida quando a mudança é só de redação.
//
// Fora da lista de propósito: Calendário (só tem 2 KPIs), TVDE (os KPIs
// mudam conforme o estado da tela) — ficam com o primeiro em destaque —, e
// Cartões, Transações e Parcelas, que desde 29/10/2026 são uma página só sem
// KPIs. Uma escolha antiga guardada para elas fica inerte em `kpiDestaque`:
// ninguém a consulta, e nada parte.

export interface KpisDaPagina {
  id: string;
  titulo: string;
  /** As CHAVES dos KPIs — é por elas que a escolha guardada em `kpiDestaque`
   *  (e a antiga, em `kpisMobile`) casa com o KPI na página. Servem também de texto do chip, exceto
   *  quando `textos` traz outro. Nunca renomear: a escolha antiga deixa de
   *  casar (não quebra, mas a página volta ao primeiro KPI). */
  rotulos: string[];
  /** Texto mostrado no chip quando o KPI foi renomeado na tela e a chave teve
   *  de ficar como estava. O KPI correspondente passa a chave em `chave`. */
  textos?: Record<string, string>;
}

export const KPIS_POR_PAGINA: KpisDaPagina[] = [
  // Início já não tem KPIs (tem o quadro "Resultado do mês", sem escolha).
  {
    id: "receitas",
    titulo: "Receitas",
    rotulos: ["Total do mês", "Maior fonte", "vs mês passado", "Média (3 meses)"],
  },
  {
    id: "despesas",
    titulo: "Despesas",
    rotulos: ["Total do mês", "Maior categoria", "vs mês passado", "Média (3 meses)"],
  },
  // As duas entradas seguintes são as duas ABAS da página Planejamento (que
  // fundiu a antiga tela Metas). Os `id` ficam como estavam, senão a escolha já
  // gravada de cada pessoa deixava de casar; só o título diz agora de que aba
  // se está a falar.
  {
    id: "planejamento",
    titulo: "Planejamento — Orçamento",
    rotulos: ["Total", "Restam", "% usado", "Valor/dia"],
    textos: { Total: "Total dos tetos" },
  },
  {
    id: "metas",
    titulo: "Planejamento — Metas",
    rotulos: ["Meta Mensal", "Taxa de Poupança", "Total em Fundos", "Poupado (12m)"],
  },
  {
    id: "veiculo",
    titulo: "Veículo",
    rotulos: ["Gasto do mês", "Abastecimentos", "Despesas", "Km no mês"],
  },
];
