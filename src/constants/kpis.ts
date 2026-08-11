// Rótulos dos KPIs de cada página, na ordem em que aparecem na tela — a fonte
// da seção "KPIs no mobile" em Definições (item 8).
//
// Os rótulos aqui TÊM que bater com os `rotulo` passados ao KpiCard em cada
// página: é por esse texto que a escolha do usuário é casada. Ao renomear um
// KPI numa tela, renomeie aqui também (a escolha antiga simplesmente deixa de
// casar e a página volta aos 2 primeiros — não quebra).
//
// Fora da lista de propósito: Calendário (só tem 2 KPIs, nada a escolher) e
// TVDE (mostra sempre os 4, sem configuração).

export interface KpisDaPagina {
  id: string;
  titulo: string;
  rotulos: string[];
}

export const KPIS_POR_PAGINA: KpisDaPagina[] = [
  { id: "inicio", titulo: "Início", rotulos: ["Receitas", "Despesas", "Saldo do mês", "Poupança"] },
  {
    id: "receitas",
    titulo: "Receitas",
    rotulos: ["Total do mês", "Lançamentos (mês)", "Maior fonte", "Total geral"],
  },
  {
    id: "despesas",
    titulo: "Despesas",
    rotulos: ["Total do mês", "Lançamentos (mês)", "Maior categoria", "Total geral"],
  },
  {
    id: "cartoes",
    titulo: "Cartões",
    rotulos: ["Devido no mês", "Pago", "Restante", "Saldo em contas"],
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
    id: "metas",
    titulo: "Metas",
    rotulos: ["Meta Mensal", "Taxa de Poupança", "Total em Fundos", "Poupado (12m)"],
  },
];
