import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Veiculo() {
  return (
    <Pagina titulo="Veículo">
      <Kpis>
        <KpiCard rotulo="Gasto do mês" valor={formatMoney(21340, "EUR")} tom="vermelho" />
        <KpiCard rotulo="Carregamentos" valor={formatMoney(9870, "EUR")} />
        <KpiCard rotulo="Km registados" valor="1.240" />
      </Kpis>
      <EmConstrucao>Cargas elétricas, quilometragem e despesas do veículo — Marco 2</EmConstrucao>
    </Pagina>
  );
}
