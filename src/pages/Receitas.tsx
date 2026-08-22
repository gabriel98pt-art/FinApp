import { TrendingUp } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useReceitasStore } from "../stores/lancamentosStore";
import { useUiStore } from "../stores/uiStore";
import {
  agruparPorChave,
  doMes,
  mediaMensal,
  mesesRecentes,
  ordenarPorDataDesc,
  receitasNosTotais,
  rotuloMes,
  rotuloVariacao,
  somarMeses,
  total,
  totalDoMes,
  variacaoMensal,
} from "../utils/calculos";
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
  const totalMes = totalDoMes(contadas, mes);

  // "vs mês passado": a mesma soma, um mês atrás. `null` quando o mês anterior
  // fechou a zero — não há percentagem contra nada, e o cartão diz isso em
  // palavras em vez de mostrar Infinity.
  const mesAnterior = somarMeses(mes, -1);
  const totalMesAnterior = totalDoMes(contadas, mesAnterior);
  const variacao = variacaoMensal(totalMes, totalMesAnterior);

  // "Média (3 meses)": os três meses ANTERIORES ao exibido, sem o incluir. O
  // mês em curso está quase sempre pela metade, e incluí-lo fazia a referência
  // afundar todo dia 1 e subir ao longo do mês — o cartão existe justamente
  // para dar um número estável contra o qual ler o mês de agora.
  const media = mediaMensal(contadas, mesesRecentes(3, mesAnterior));

  // "Maior fonte": de onde veio a maior fatia do dinheiro do mês. Substitui uma
  // contagem de lançamentos que só repetia, em número, a lista logo abaixo —
  // ver o card irmão "Maior categoria" em Despesas. Sem exclusões como as de
  // `maiorCategoriaRelevante` (veículo/aluguel): do lado da receita a fonte
  // dominante é justamente o que interessa saber, e quanto ela pesa.
  const maiorFonte = agruparPorChave(doMes(contadas, mes), (r) => r.fonte)[0] ?? null;

  return (
    <Pagina titulo="Receitas">
      <Kpis pagina="receitas">
        <KpiCard rotulo="Total do mês" valor={formatMoney(totalMes, moeda)} tom="verde" />
        <KpiCard
          rotulo="Maior fonte"
          valor={maiorFonte ? formatMoney(maiorFonte.valor, moeda) : "—"}
          sub={
            maiorFonte ? `${maiorFonte.nome} · ${maiorFonte.pct}% do mês` : "sem receitas no mês"
          }
        />
        {/* Do lado da receita, subir é bom — o verde/vermelho é o contrário do
            mesmo cartão em Despesas. */}
        <KpiCard
          rotulo="vs mês passado"
          valor={variacao === null ? (totalMes > 0 ? "Novo" : "—") : rotuloVariacao(variacao)}
          sub={`${rotuloMes(mesAnterior)}: ${formatMoney(totalMesAnterior, moeda)}`}
          tom={variacao === null || variacao === 0 ? "neutro" : variacao > 0 ? "verde" : "vermelho"}
        />
        <KpiCard
          rotulo="Média (3 meses)"
          valor={media ? formatMoney(media.media, moeda) : "—"}
          sub={
            media
              ? media.meses === 3
                ? "os 3 meses antes deste"
                : `só ${media.meses} ${media.meses === 1 ? "mês" : "meses"} de história`
              : "sem meses anteriores"
          }
          // Era "laranja" (cor exclusiva do TVDE) — "neutro" porque é um
          // dado contextual, não um sinal de bom/mau (achado da auditoria).
          tom="neutro"
        />
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
