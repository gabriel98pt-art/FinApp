import { TrendingDown } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { despesasNosTotais, doMes, mesAtual, ordenarPorDataDesc, total } from "../utils/calculos";
import { despesaRealizadaMes } from "../utils/resumoMensal";
import { totalVeiculoGeral } from "../utils/veiculo";
import { formatMoney } from "../utils/money";

export default function Despesas() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const veiculo = useVeiculoStore((s) => s.dados);

  const mes = mesAtual();
  // KPIs excluem pagamentos de fatura (a compra já contou — seção 4.1);
  // a LISTA mostra tudo, com a nota indicando a origem.
  const contadas = despesasNosTotais(itens);
  // total do mês/geral inclui o veículo (Parte A) — fonte única em utils/
  const totalDoMesComVeiculo = despesaRealizadaMes(itens, veiculo, mes, mes);
  const totalGeralComVeiculo = total(contadas) + totalVeiculoGeral(veiculo);

  function editar(id: string) {
    const item = itens.find((d) => d.id === id);
    if (item?.origem === "fat") {
      mostrarToast("Pagamento de fatura — gerencie na tela Cartões.");
      return;
    }
    if (item?.origem === "parc") {
      mostrarToast("Lançamento de parcela — gerencie na tela Parcelas.");
      return;
    }
    abrirRegistro("despesa", id);
  }

  return (
    <Pagina titulo="Despesas">
      <Kpis>
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMesComVeiculo, moeda)}
          tom="vermelho"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(contadas, mes).length)} />
        <KpiCard rotulo="Total geral" valor={formatMoney(totalGeralComVeiculo, moeda)} />
      </Kpis>

      <ListaLancamentos
        titulo="Lançamentos"
        itens={ordenarPorDataDesc(itens).map((d) => ({
          id: d.id,
          descricao: d.descricao,
          valor: d.valor,
          data: d.data,
          etiqueta: d.nota ? `${d.categoria} · ${d.nota}` : d.categoria,
        }))}
        carregado={carregado}
        tom="vermelho"
        moeda={moeda}
        vazio="Nenhuma despesa ainda"
        vazioSub="Toque em Adicionar para lançar a primeira."
        vazioIcone={TrendingDown}
        aoAdicionar={() => abrirRegistro("despesa")}
        aoEditar={editar}
      />
    </Pagina>
  );
}
