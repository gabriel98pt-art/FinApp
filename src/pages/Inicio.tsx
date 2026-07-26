import { useNavigate } from "react-router-dom";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import CopilotoCard from "../components/CopilotoCard";
import DonutCategoriaCard from "../components/DonutCategoriaCard";
import ResumoAnual from "../components/ResumoAnual";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { despesasNosTotais, mesAtual, saldoTotal } from "../utils/calculos";
import { totalFixasGeral } from "../utils/despesasFixas";
import { totalParcelasGeral } from "../utils/parcelas";
import { resumoMesCompleto } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { formatMoney } from "../utils/money";

export default function Inicio() {
  const navegar = useNavigate();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const modoDiscreto = useCfgStore((s) => s.cfg.modoDiscreto);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  const mes = mesAtual();
  // despesa do mês inclui fixas gerais + parcelas + veículo (Parte A) — fonte
  // única em utils/resumoMensal.ts
  const resumo = resumoMesCompleto(receitas, despesas, despesasFixas, parcelas, veiculo, mes, mes);
  // Poupança acumulada: mesmas exclusões e os mesmos quatro termos do "Total
  // geral" da tela Despesas (Despesas.tsx). Sem `despesasNosTotais` aqui, o
  // pagamento de fatura contava como despesa por cima da compra original e a
  // parcela contava pelo espelho em vez do plano — dois números diferentes
  // para a mesma ideia, em duas telas.
  const acumulado =
    saldoTotal(receitas, despesasNosTotais(despesas)) -
    totalFixasGeral(despesasFixas) -
    totalParcelasGeral(parcelas) -
    totalVeiculoGeral(veiculo);

  return (
    <Pagina titulo="Início">
      <Kpis pagina="inicio">
        <KpiCard
          rotulo="Receitas"
          valor={formatMoney(resumo.receitas, moeda)}
          tom="verde"
          aoClicar={() => navegar("/receitas")}
        />
        <KpiCard
          rotulo="Despesas"
          valor={formatMoney(resumo.despesas, moeda)}
          tom="vermelho"
          aoClicar={() => navegar("/despesas")}
        />
        <KpiCard
          rotulo="Saldo do mês"
          valor={formatMoney(resumo.saldo, moeda)}
          tom={resumo.saldo >= 0 ? "acento" : "vermelho"}
        />
        <KpiCard
          rotulo="Poupança"
          valor={formatMoney(acumulado, moeda)}
          tom={acumulado >= 0 ? "amarelo" : "vermelho"}
          discreto={modoDiscreto}
        />
      </Kpis>
      <DonutCategoriaCard />
      <ResumoAnual meses={6} titulo="Resumo Anual" />
      <CopilotoCard />
    </Pagina>
  );
}
