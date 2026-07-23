import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Metas() {
  return (
    <Pagina titulo="Metas">
      <Kpis>
        <KpiCard rotulo="Meta de poupança" valor={formatMoney(50000, "EUR")} tom="acento" />
        <KpiCard rotulo="Poupado no mês" valor={formatMoney(32000, "EUR")} tom="verde" />
        <KpiCard rotulo="Fundos ativos" valor="2" />
      </Kpis>
      <EmConstrucao>Progresso da meta, fundos/cofrinhos e resumo anual — Marco 2</EmConstrucao>
    </Pagina>
  );
}
