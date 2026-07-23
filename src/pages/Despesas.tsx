import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Despesas() {
  return (
    <Pagina titulo="Despesas">
      <Kpis>
        <KpiCard rotulo="Total do mês" valor={formatMoney(135468, "EUR")} tom="vermelho" />
        <KpiCard rotulo="Fixas" valor={formatMoney(84500, "EUR")} />
        <KpiCard rotulo="Correntes" valor={formatMoney(50968, "EUR")} />
        <KpiCard rotulo="Pendentes" valor="2" tom="amarelo" />
      </Kpis>
      <EmConstrucao>Despesas fixas (pago/pendente) e correntes com filtros — Marco 2</EmConstrucao>
    </Pagina>
  );
}
