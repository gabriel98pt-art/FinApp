import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Parcelas() {
  return (
    <Pagina titulo="Parcelas">
      <Kpis>
        <KpiCard rotulo="Em andamento" valor="3" />
        <KpiCard rotulo="Débito mensal" valor={formatMoney(18750, "EUR")} tom="vermelho" />
        <KpiCard rotulo="Falta pagar" valor={formatMoney(112500, "EUR")} />
      </Kpis>
      <EmConstrucao>Tabela com progresso e quitação antecipada (seção 4.3) — Marco 2</EmConstrucao>
    </Pagina>
  );
}
