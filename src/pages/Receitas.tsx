import { TrendingUp } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useReceitasStore } from "../stores/lancamentosStore";
import { useUiStore } from "../stores/uiStore";
import { doMes, ordenarPorDataDesc, rotuloMes, total, totalDoMes } from "../utils/calculos";
import { formatMoney } from "../utils/money";

export default function Receitas() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const itens = useReceitasStore((s) => s.itens);
  const carregado = useReceitasStore((s) => s.carregado);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  // Mês compartilhado com as outras telas (stores/mesVisivelStore.ts)
  const mes = useMesVisivelStore((s) => s.mes);

  const doMesExibido = doMes(itens, mes);

  return (
    <Pagina titulo="Receitas">
      <Kpis pagina="receitas">
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMes(itens, mes), moeda)}
          tom="verde"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMesExibido.length)} />
        <KpiCard rotulo="Total geral" valor={formatMoney(total(itens), moeda)} />
      </Kpis>

      <ListaLancamentos
        /* key: trocar de mês remonta a lista e volta pra página 1 */
        key={mes}
        titulo="Lançamentos"
        itens={ordenarPorDataDesc(doMesExibido).map((r) => ({
          id: r.id,
          descricao: r.descricao,
          valor: r.valor,
          data: r.data,
          etiqueta: r.fonte,
        }))}
        carregado={carregado}
        tom="verde"
        moeda={moeda}
        rotuloTotal={`Total ${rotuloMes(mes)}`}
        vazio={`Nenhuma receita em ${rotuloMes(mes)}`}
        vazioSub="Toque em Adicionar para lançar a primeira."
        vazioIcone={TrendingUp}
        aoAdicionar={() => abrirRegistro("receita")}
        aoEditar={(id) => abrirRegistro("receita", id)}
      />
    </Pagina>
  );
}
