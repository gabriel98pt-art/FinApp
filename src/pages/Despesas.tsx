import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useDespesasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import {
  despesasNosTotais,
  doMes,
  mesAtual,
  ordenarPorDataDesc,
  total,
  totalDoMes,
} from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Despesas() {
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  const mes = mesAtual();
  // KPIs excluem pagamentos de fatura (a compra já contou — seção 4.1);
  // a LISTA mostra tudo, com a nota indicando a origem.
  const contadas = despesasNosTotais(itens);

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
          valor={formatMoney(totalDoMes(contadas, mes), "EUR")}
          tom="vermelho"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(contadas, mes).length)} />
        <KpiCard rotulo="Total geral" valor={formatMoney(total(contadas), "EUR")} />
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
        vazio="Nenhuma despesa ainda — toque em Adicionar para lançar a primeira."
        aoAdicionar={() => abrirRegistro("despesa")}
        aoEditar={editar}
      />
    </Pagina>
  );
}
