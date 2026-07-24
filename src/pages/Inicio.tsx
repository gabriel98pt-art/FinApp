import Pagina, { EmConstrucao, Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import CopilotoCard from "../components/CopilotoCard";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual, saldoTotal } from "../utils/calculos";
import { resumoMesCompleto } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { formatMoney } from "../utils/money";

export default function Inicio() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const mes = mesAtual();
  // despesa do mês inclui o veículo (Parte A) — fonte única em utils/resumoMensal.ts
  const resumo = resumoMesCompleto(receitas, despesas, veiculo, mes, mes);
  const acumulado = saldoTotal(receitas, despesas) - totalVeiculoGeral(veiculo);

  return (
    <Pagina titulo="Início">
      <Kpis>
        <KpiCard
          rotulo="Saldo do mês"
          valor={formatMoney(resumo.saldo, moeda)}
          tom={resumo.saldo >= 0 ? "acento" : "vermelho"}
        />
        <KpiCard rotulo="Receitas" valor={formatMoney(resumo.receitas, moeda)} tom="verde" />
        <KpiCard rotulo="Despesas" valor={formatMoney(resumo.despesas, moeda)} tom="vermelho" />
        <KpiCard
          rotulo="Poupança"
          valor={formatMoney(acumulado, moeda)}
          tom={acumulado >= 0 ? "amarelo" : "vermelho"}
          discreto={modoDiscreto}
        />
      </Kpis>
      <EmConstrucao>Orçamento por categoria — Marco 4</EmConstrucao>
      <EmConstrucao>Resumo anual — Marco 4</EmConstrucao>
      <CopilotoCard />
    </Pagina>
  );
}
