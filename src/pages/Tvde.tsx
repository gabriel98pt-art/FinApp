import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { formatMoney } from "../utils/money";

// TVDE formata sempre em EUR, independente da moeda da conta (seção 4.4)
export default function Tvde() {
  return (
    <Pagina titulo="TVDE">
      <Kpis>
        <KpiCard rotulo="Semana atual" valor={formatMoney(68450, "EUR")} tom="verde" />
        <KpiCard rotulo="Mês" valor={formatMoney(241200, "EUR")} />
        <KpiCard rotulo="Seg. Social pendente" valor={formatMoney(15300, "EUR")} tom="amarelo" />
      </Kpis>
      <EmConstrucao>
        Semanas, médias e Segurança Social — fórmulas portadas tal como estão da planilha (seção
        4.4), Marco 3
      </EmConstrucao>
    </Pagina>
  );
}
