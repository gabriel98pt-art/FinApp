import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useDespesasStore } from "../stores/lancamentosStore";
import { useUiStore } from "../stores/uiStore";
import { doMes, mesAtual, ordenarPorDataDesc, total, totalDoMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Despesas() {
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  const mes = mesAtual();

  return (
    <Pagina titulo="Despesas">
      <Kpis>
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMes(itens, mes), "EUR")}
          tom="vermelho"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(itens, mes).length)} />
        <KpiCard rotulo="Total geral" valor={formatMoney(total(itens), "EUR")} />
      </Kpis>

      <ListaLancamentos
        titulo="Lançamentos"
        itens={ordenarPorDataDesc(itens).map((d) => ({
          id: d.id,
          descricao: d.descricao,
          valor: d.valor,
          data: d.data,
          etiqueta: d.categoria,
        }))}
        carregado={carregado}
        tom="vermelho"
        vazio="Nenhuma despesa ainda — toque em Adicionar para lançar a primeira."
        aoAdicionar={() => abrirRegistro("despesa")}
        aoEditar={(id) => abrirRegistro("despesa", id)}
      />
    </Pagina>
  );
}
