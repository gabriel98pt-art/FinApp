import { TrendingUp } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useCfgStore } from "../stores/cfgStore";
import { useReceitasStore } from "../stores/lancamentosStore";
import { useUiStore } from "../stores/uiStore";
import { doMes, mesAtual, ordenarPorDataDesc, total, totalDoMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Receitas() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const itens = useReceitasStore((s) => s.itens);
  const carregado = useReceitasStore((s) => s.carregado);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  const mes = mesAtual();

  return (
    <Pagina titulo="Receitas">
      <Kpis>
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMes(itens, mes), moeda)}
          tom="verde"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(itens, mes).length)} />
        <KpiCard rotulo="Total geral" valor={formatMoney(total(itens), moeda)} />
      </Kpis>

      <ListaLancamentos
        titulo="Lançamentos"
        itens={ordenarPorDataDesc(itens).map((r) => ({
          id: r.id,
          descricao: r.descricao,
          valor: r.valor,
          data: r.data,
          etiqueta: r.fonte,
        }))}
        carregado={carregado}
        tom="verde"
        moeda={moeda}
        vazio="Nenhuma receita ainda"
        vazioSub="Toque em Adicionar para lançar a primeira."
        vazioIcone={TrendingUp}
        aoAdicionar={() => abrirRegistro("receita")}
        aoEditar={(id) => abrirRegistro("receita", id)}
      />
    </Pagina>
  );
}
