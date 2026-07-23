import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

export default function Cartoes() {
  return (
    <Pagina titulo="Cartões">
      <Kpis>
        <KpiCard rotulo="Fatura atual" valor={formatMoney(64230, "EUR")} tom="acento" />
        <KpiCard rotulo="Já pago" valor={formatMoney(20000, "EUR")} tom="verde" />
        <KpiCard rotulo="Restante" valor={formatMoney(44230, "EUR")} tom="amarelo" />
      </Kpis>
      <EmConstrucao>Fluxo de fatura por cartão/mês (seção 4.1) — Marco 2</EmConstrucao>
    </Pagina>
  );
}
