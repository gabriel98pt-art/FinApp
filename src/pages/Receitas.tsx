import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Receitas() {
  return (
    <Pagina titulo="Receitas">
      <Kpis>
        <KpiCard rotulo="Total do mês" valor={formatMoney(320000, "EUR")} tom="verde" />
        <KpiCard rotulo="Recorrentes" valor={formatMoney(280000, "EUR")} />
        <KpiCard rotulo="Fontes ativas" valor="3" />
      </Kpis>
      <EmConstrucao>Gráfico de evolução (6 meses) e lançamentos — Marco 2</EmConstrucao>
    </Pagina>
  );
}
