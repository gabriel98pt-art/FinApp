// Rótulos dos KPIs de cada página, na ordem em que aparecem na tela — a fonte
// da seção "KPIs no mobile" em Definições (item 8).
//
// Os rótulos aqui TÊM que bater com os `rotulo` (ou `chave`) passados ao
// KpiCard em cada página: é por esse texto que a escolha do usuário é casada.
// Ao renomear um KPI numa tela há duas saídas: renomear aqui também — e quem
// já tinha escolhido esse cartão volta aos 2 primeiros —, ou manter a chave e
// dar o texto novo em `textos`, passando a chave antiga em `chave` no KpiCard.
// A segunda é a preferida quando a mudança é só de redação.
//
// Fora da lista de propósito: Calendário (só tem 2 KPIs, nada a escolher) e
// TVDE (mostra sempre os 4, sem configuração).

export interface KpisDaPagina {
  id: string;
  titulo: string;
  /** As CHAVES dos KPIs — é por elas que a escolha guardada em `kpisMobile`
   *  casa com o cartão na página. Servem também de texto do chip, exceto
   *  quando `textos` traz outro. Nunca renomear: a escolha antiga deixa de
   *  casar (não quebra, mas a página volta aos 2 primeiros). */
  rotulos: string[];
  /** Texto mostrado no chip quando o KPI foi renomeado na tela e a chave teve
   *  de ficar como estava. O cartão correspondente passa a chave em `chave`. */
  textos?: Record<string, string>;
}

export const KPIS_POR_PAGINA: KpisDaPagina[] = [
  { id: "inicio", titulo: "Início", rotulos: ["Receitas", "Despesas", "Saldo do mês", "Poupança"] },
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
  },
  {
    id: "metas",
    titulo: "Planejamento — Metas",
    rotulos: ["Meta Mensal", "Taxa de Poupança", "Total em Fundos", "Poupado (12m)"],
  },
  {
    id: "cartoes",
    titulo: "Cartões",
    rotulos: ["Devido no mês", "Pago", "Restante", "Saldo em contas"],
    // "Devido no mês" soava a cobrança em atraso quando o cartão é só
    // informativo. A chave fica; o texto passa a ser o neutro.
    textos: { "Devido no mês": "A pagar este mês" },
  },
  {
    id: "veiculo",
    titulo: "Veículo",
    rotulos: ["Gasto do mês", "Carregamentos", "Despesas", "Km no mês"],
  },
  {
    id: "parcelas",
    titulo: "Parcelas",
    rotulos: ["Total do mês", "Falta pagar", "Restante", "Parcelas ativas"],
  },
  {
    id: "transacoes",
    titulo: "Transações",
    rotulos: ["Entradas", "Saídas", "Saldo"],
  },
];
