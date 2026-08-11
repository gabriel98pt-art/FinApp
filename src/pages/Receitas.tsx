import { TrendingUp } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useReceitasStore } from "../stores/lancamentosStore";
import { useUiStore } from "../stores/uiStore";
import {
  doMes,
  ordenarPorDataDesc,
  receitasNosTotais,
  rotuloMes,
  total,
  totalDoMes,
} from "../utils/calculos";
import { maiorFonteMes } from "../utils/receitaPorCategoria";
import { formatMoney } from "../utils/money";

export default function Receitas() {
  const moeda = useCfgStore((s) => s.cfg.currency);
  const itens = useReceitasStore((s) => s.itens);
  const carregado = useReceitasStore((s) => s.carregado);
  const erro = useReceitasStore((s) => s.erro);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  // Mês compartilhado com as outras telas (stores/mesVisivelStore.ts)
  const mes = useMesVisivelStore((s) => s.mes);

  // KPIs e rodapé excluem o ajuste de reconciliação; a LISTA mostra tudo,
  // igual ao que Despesas faz com pagamento de fatura e espelho de parcela.
  const contadas = receitasNosTotais(itens);
  const doMesExibido = doMes(itens, mes);
  const maiorFonte = maiorFonteMes(itens, mes);
  // "Total geral": histórico completo, sem filtro de mês — pra quem quer ver
  // o acumulado de sempre, não só o mês exibido.
  const totalGeral = total(contadas);

  return (
    <Pagina titulo="Receitas">
      <Kpis pagina="receitas">
        <KpiCard
          rotulo="Total do mês"
          valor={formatMoney(totalDoMes(contadas, mes), moeda)}
          tom="verde"
        />
        <KpiCard rotulo="Lançamentos (mês)" valor={String(doMes(contadas, mes).length)} />
        <KpiCard
          rotulo="Maior fonte"
          valor={maiorFonte ? maiorFonte.fonte : "—"}
          sub={maiorFonte ? formatMoney(maiorFonte.valor, moeda) : undefined}
        />
        <KpiCard rotulo="Total geral" valor={formatMoney(totalGeral, moeda)} tom="laranja" />
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
          etiqueta: r.nota ? `${r.fonte} · ${r.nota}` : r.fonte,
          categoria: r.fonte,
        }))}
        carregado={carregado}
        erro={erro}
        tom="verde"
        moeda={moeda}
        rotuloTotal={`Total ${rotuloMes(mes)}`}
        total={total(receitasNosTotais(doMesExibido))}
        vazio={`Nenhuma receita em ${rotuloMes(mes)}`}
        vazioSub="Toque em Adicionar para lançar a primeira."
        vazioIcone={TrendingUp}
        aoAdicionar={() => abrirRegistro("receita")}
        aoEditar={(id) => abrirRegistro("receita", id)}
      />
    </Pagina>
  );
}
