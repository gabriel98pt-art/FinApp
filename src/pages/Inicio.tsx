import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { mesAtual, resumoMes, saldoTotal } from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Inicio() {
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);

  const resumo = resumoMes(receitas, despesas, mesAtual());
  const acumulado = saldoTotal(receitas, despesas);

  return (
    <Pagina titulo="Início">
      <Kpis>
        <KpiCard
          rotulo="Saldo do mês"
          valor={formatMoney(resumo.saldo, "EUR")}
          tom={resumo.saldo >= 0 ? "acento" : "vermelho"}
        />
        <KpiCard rotulo="Receitas" valor={formatMoney(resumo.receitas, "EUR")} tom="verde" />
        <KpiCard rotulo="Despesas" valor={formatMoney(resumo.despesas, "EUR")} tom="vermelho" />
        <KpiCard
          rotulo="Poupança (acumulada)"
          valor={formatMoney(acumulado, "EUR")}
          tom={acumulado >= 0 ? "amarelo" : "vermelho"}
        />
      </Kpis>
      <EmConstrucao>Orçamento por categoria — Marco 3</EmConstrucao>
      <EmConstrucao>Resumo anual — Marco 3</EmConstrucao>
      <EmConstrucao>Copiloto — Marco 3</EmConstrucao>
    </Pagina>
  );
}
