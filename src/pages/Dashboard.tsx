import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

// Valores fictícios só para dar corpo visual à casca (Marco 1)
export default function Dashboard() {
  return (
    <Pagina titulo="Dashboard">
      <Kpis>
        <KpiCard rotulo="Saldo do mês" valor={formatMoney(184532, "EUR")} tom="acento" />
        <KpiCard rotulo="Receitas" valor={formatMoney(320000, "EUR")} tom="verde" />
        <KpiCard rotulo="Despesas" valor={formatMoney(135468, "EUR")} tom="vermelho" />
        <KpiCard rotulo="Poupança" valor={formatMoney(50000, "EUR")} tom="amarelo" />
      </Kpis>
      <EmConstrucao>Orçamento por categoria — Marco 2</EmConstrucao>
      <EmConstrucao>Progresso da poupança — Marco 2</EmConstrucao>
      <EmConstrucao>Resumo anual — Marco 2</EmConstrucao>
      <EmConstrucao>Copiloto — Marco 3</EmConstrucao>
    </Pagina>
  );
}
