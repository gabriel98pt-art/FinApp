import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import CopilotoCard from "../components/CopilotoCard";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { despesasNosTotais, mesAtual, resumoMes, saldoTotal } from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Inicio() {
  const receitas = useReceitasStore((s) => s.itens);
  // Pagamentos de fatura (origem 'fat') ficam fora: a compra já contou (4.1)
  const despesas = despesasNosTotais(useDespesasStore((s) => s.itens));

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
          rotulo="Poupança"
          valor={formatMoney(acumulado, "EUR")}
          tom={acumulado >= 0 ? "amarelo" : "vermelho"}
        />
      </Kpis>
      <EmConstrucao>Orçamento por categoria — Marco 4</EmConstrucao>
      <EmConstrucao>Resumo anual — Marco 4</EmConstrucao>
      <CopilotoCard />
    </Pagina>
  );
}
