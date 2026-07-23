import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";

export default function Calendario() {
  return (
    <Pagina titulo="Calendário">
      <Kpis>
        <KpiCard rotulo="Eventos este mês" valor="5" />
        <KpiCard rotulo="Próximos 7 dias" valor="2" tom="amarelo" />
      </Kpis>
      <EmConstrucao>Grid mensal com dias clicáveis e eventos futuros — Marco 2</EmConstrucao>
    </Pagina>
  );
}
