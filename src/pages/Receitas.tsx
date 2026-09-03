import { useState } from "react";
import { TrendingUp } from "lucide-react";
import Pagina, { Kpis } from "../components/Pagina";
import KpiCard from "../components/KpiCard";
import ListaLancamentos from "../components/ListaLancamentos";
import SeletorOrdem from "../components/SeletorOrdem";
import SeletorSemana from "../components/SeletorSemana";
import SeletorVisao from "../components/SeletorVisao";
import { compararPorOrdem, type Ordem } from "../utils/ordem";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import { removerReceita } from "../services/lancamentosService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useUidSessao } from "../hooks/useUidSessao";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useReceitasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import {
  agruparPorChave,
  doMes,
  hojeIso,
  mediaMensal,
  mesesRecentes,
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
  const uid = useUidSessao();
  const confirmar = useConfirmar();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const diaInicioSemana = useCfgStore((s) => s.cfg.diaInicioSemana);
  const itens = useReceitasStore((s) => s.itens);
  const carregado = useReceitasStore((s) => s.carregado);
  const erro = useReceitasStore((s) => s.erro);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  // Item 2 do lote de UX/nav: Excluir vira ação do menu único, ao lado de
  // Editar.
  async function excluirReceita(id: string) {
    const item = itens.find((r) => r.id === id);
    if (!item) return;
    if (!(await confirmar(`Excluir "${item.descricao}"?`))) return;
    try {
      await removerReceita(uid, id);
      mostrarToast("Receita excluída");
    } catch {
      mostrarToast("Não foi possível excluir. Tente de novo.");
    }
  }

  // Mês compartilhado com as outras telas (stores/mesVisivelStore.ts)
  const mes = useMesVisivelStore((s) => s.mes);

  // Ordem da lista (item 14) e visão Mês/Semana (item 10) — o mesmo par que
  // Despesas correntes já tinha. Nenhum dos dois persiste: sair da tela volta
  // a "Mais recentes" e a "Mês".
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [visao, setVisao] = useState<"mes" | "semana">("mes");

  const hoje = hojeIso();
  // Semanas do mês exibido; trocar de mês reposiciona na semana de hoje (ou
  // na ponta mais perto dela, quando hoje está fora do mês — ver
  // `indiceDaSemana`). Já nasce na semana de hoje: sem isto, a primeira vez
  // que se troca para "Semana" abria sempre na primeira do mês.
  const semanas = semanasDoMes(mes, diaInicioSemana);
  const idxPadrao = indiceDaSemana(semanas, hoje);
  const [semanaIdx, setSemanaIdx] = useState(idxPadrao);
  const [mesDaSemana, setMesDaSemana] = useState(mes);
  if (mesDaSemana !== mes) {
    setMesDaSemana(mes);
    setSemanaIdx(idxPadrao);
  }
  const semanaAtual = semanas[Math.min(semanaIdx, semanas.length - 1)];

  // KPIs e rodapé excluem o ajuste de reconciliação; a LISTA mostra tudo,
  // igual ao que Despesas faz com pagamento de fatura e espelho de parcela.
  const contadas = receitasNosTotais(itens);
  // O que a LISTA mostra: o mês inteiro, ou só a semana escolhida. Os KPIs
  // continuam a ler `mes`/`contadas` — só o primeiro cartão acompanha a
  // semana (ver `porSemana` abaixo), pela mesma razão de Despesas: uma
  // semana é amostra pequena demais para "vs mês passado" e "Média".
  const doPeriodo =
    visao === "semana" && semanaAtual ? naSemana(itens, semanaAtual) : doMes(itens, mes);
  const totalMes = totalDoMes(contadas, mes);
  // Com "Semana" escolhida, o primeiro KPI passa a falar da semana — o mesmo
  // total que o rodapé da lista já mostra lá em baixo.
  const porSemana = visao === "semana" && semanaAtual !== undefined;
  const totalPeriodo = total(receitasNosTotais(doPeriodo));

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
        {/* `chave` fixa: o rótulo muda de texto com a visão, mas a escolha de
            "KPIs no mobile" (constants/kpis.ts) casa por esta chave — igual
            ao cartão irmão em Despesas. */}
        <KpiCard
          rotulo={porSemana ? "Total da semana" : "Total do mês"}
          chave="Total do mês"
          valor={formatMoney(porSemana ? totalPeriodo : totalMes, moeda)}
          sub={porSemana && semanaAtual ? rotuloDaSemana(semanaAtual) : undefined}
          tom="verde"
        />
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

      <SeletorVisao valor={visao} aoMudar={setVisao}>
        {visao === "semana" && (
          <SeletorSemana semanas={semanas} indice={semanaIdx} aoMudar={setSemanaIdx} />
        )}
      </SeletorVisao>

      <SeletorOrdem valor={ordem} aoMudar={setOrdem} />

      <ListaLancamentos
        /* key: trocar de mês, de ordem ou de semana remonta a lista e volta
           pra página 1 */
        key={`${mes}-${ordem}-${visao}-${semanaIdx}`}
        titulo="Lançamentos"
        rotuloAdicionar="Adicionar receita"
        itens={[...doPeriodo].sort(compararPorOrdem(ordem)).map((r) => ({
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
        rotuloTotal={
          porSemana && semanaAtual
            ? `Total ${rotuloDaSemana(semanaAtual)}`
            : `Total ${rotuloMes(mes)}`
        }
        total={totalPeriodo}
        vazio={
          porSemana && semanaAtual
            ? `Nenhuma receita em ${rotuloDaSemana(semanaAtual)}`
            : `Nenhuma receita em ${rotuloMes(mes)}`
        }
        vazioSub="Toque em Adicionar para lançar a primeira."
        vazioIcone={TrendingUp}
        aoAdicionar={() => abrirRegistro("receita")}
        aoEditar={(id) => abrirRegistro("receita", id)}
        aoExcluir={(id) => void excluirReceita(id)}
      />
    </Pagina>
  );
}
