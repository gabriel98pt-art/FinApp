import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Repeat, Square, SquareCheck, TrendingDown } from "lucide-react";
import Pagina, { EstadoVazio, Kpis } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import BottomSheet from "../components/BottomSheet";
import KpiCard from "../components/KpiCard";
import ErroSincronizacao from "../components/ErroSincronizacao";
import CampoMoeda from "../components/CampoMoeda";
import ListaLancamentos from "../components/ListaLancamentos";
import Seletor from "../components/Seletor";
import SeletorCategoria from "../components/SeletorCategoria";
import SeletorOrdem from "../components/SeletorOrdem";
import SeletorSemana from "../components/SeletorSemana";
import { compararPorOrdem, type Ordem } from "../utils/ordem";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "../utils/semanas";
import {
  alternarPagoDespesaFixa,
  atualizarDespesaFixa,
  criarDespesaFixa,
  removerDespesaFixa,
} from "../services/lancamentosService";
import { useAbasTeclado } from "../hooks/useAbasTeclado";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useMesVisivelStore } from "../stores/mesVisivelStore";
import { useDespesasFixasStore, useDespesasStore } from "../stores/lancamentosStore";
import { mostrarToast } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import {
  despesasNosTotais,
  doMes,
  hojeIso,
  mediaDeMeses,
  mesAtual,
  mesesRecentes,
  rotuloMes,
  rotuloVariacao,
  somarMeses,
  total,
  variacaoMensal,
} from "../utils/calculos";
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "../utils/fatura";
import { LIMIAR_PERTO_ORCAMENTO, statusOrcamentoMes } from "../utils/orcamento";
import { liquidoDaDespesa } from "../utils/reembolsos";
import { despesaRealizadaMes, primeiroMesComDespesa } from "../utils/resumoMensal";
import { despesaPorCategoriaMes, maiorCategoriaRelevante } from "../utils/despesaPorCategoria";
import { formatMoney } from "../utils/money";
import type { Cents, DespesaFixa, Id } from "../types";
import { idAba, idPainelAba } from "../utils/abas";
import styles from "./Despesas.module.css";

type Aba = "correntes" | "fixas";

/** Fonte única da ordem das abas: a lista desenhada e a ordem que as setas do
 *  teclado percorrem têm de ser a mesma, senão a seta salta para o lado
 *  errado. */
const ABAS = [
  ["correntes", "Correntes"],
  ["fixas", "Fixas"],
] as const satisfies readonly (readonly [Aba, string])[];

function agir(acao: () => Promise<unknown>, ok: string) {
  return acao()
    .then(() => mostrarToast(ok))
    .catch(() => mostrarToast("Não foi possível concluir. Tente de novo."));
}

export default function Despesas() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const confirmar = useConfirmar();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const cfg = useCfgStore((s) => s.cfg);
  const itens = useDespesasStore((s) => s.itens);
  const carregado = useDespesasStore((s) => s.carregado);
  const erroDespesas = useDespesasStore((s) => s.erro);
  const erroFixas = useDespesasFixasStore((s) => s.erro);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);
  const parcelas = useParcelasStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);

  // Chegar de Transações "Abrir em Despesas → Fixas" (item 4.6) já abre na
  // aba certa — a rota manda o destino pelo state da navegação, porque a aba
  // é estado local desta página.
  const location = useLocation();
  const abaPedida = (location.state as { aba?: string } | null)?.aba;
  const abaInicial = ABAS.some(([id]) => id === abaPedida) ? (abaPedida as Aba) : "correntes";
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { propsLista, propsAba } = useAbasTeclado({
    abas: ABAS.map(([id]) => id),
    atual: aba,
    aoMudar: setAba,
  });
  // Ordem da lista de correntes (item 14) — não persiste entre visitas.
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  // Visão Mês / Semana da lista de correntes (item 10).
  const [visao, setVisao] = useState<"mes" | "semana">("mes");

  // Mês exibido é compartilhado entre as telas (stores/mesVisivelStore.ts) e
  // entre as abas desta — Despesas e Fixas andam sempre no mesmo mês.
  const mes = useMesVisivelStore((s) => s.mes);
  const mesReal = mesAtual();
  // Já nasce na semana de hoje, igual ao mês — sem isto, a primeira vez que
  // se troca para "Semana" abria sempre na primeira do mês em vez da atual.
  const [semanaIdx, setSemanaIdx] = useState(() =>
    indiceDaSemana(semanasDoMes(mes, cfg.diaInicioSemana), hojeIso()),
  );
  // KPIs excluem pagamentos de fatura (a compra já contou — seção 4.1); a LISTA
  // mostra tudo, com a nota indicando a origem. Quem faz essa exclusão nos
  // totais é `despesaRealizadaMes` (via `despesasNosTotais`), e aqui em baixo
  // `contadasDoPeriodo` faz o mesmo para a visão de semana.
  //
  // Total do mês/geral inclui fixas gerais + parcelas + veículo (Parte A) —
  // fonte única em utils/resumoMensal.ts
  const totalDoMesComVeiculo = despesaRealizadaMes(
    itens,
    despesasFixas,
    parcelas,
    veiculo,
    mes,
    mesReal,
    hojeIso(),
  );
  // Card "Maior categoria": a maior fatia do mês fora veículo e aluguel — as
  // duas lideram quase sempre e não dizem nada de novo (ver o util).
  const maiorCategoria = maiorCategoriaRelevante(
    despesaPorCategoriaMes(itens, despesasFixas, parcelas, veiculo, mes, mesReal, hojeIso()),
  );
  // Teto da maior categoria (seção 4.8), se houver um configurado — mesma
  // base de cálculo do orçamento (correntes + parcelas, sem fixas/veículo:
  // ver orcamento.ts), por isso só o estado (perto/estourou) entra no cartão,
  // nunca a % — o valor já mostrado no cartão é o total mais amplo do resumo
  // por categoria, os dois números não são a mesma coisa.
  const statusMaiorCategoria = maiorCategoria
    ? statusOrcamentoMes(itens, parcelas, cfg.orcamentos, mes, mesReal, hojeIso()).find(
        (s) => s.categoria === maiorCategoria.categoria,
      )
    : undefined;
  const pertoMaiorCategoria =
    !!statusMaiorCategoria &&
    !statusMaiorCategoria.estourado &&
    statusMaiorCategoria.pct >= LIMIAR_PERTO_ORCAMENTO;
  // "vs mês passado": o mesmo total do mês, um mês atrás — pelas mesmas quatro
  // parcelas (correntes + fixas + parcelas + veículo), senão comparava-se coisa
  // com coisa diferente. Fica sempre mensal, mesmo com "Semana" escolhida, pela
  // razão de "Maior categoria": uma semana contra outra é amostra pequena
  // demais e o número saltava sem querer dizer nada.
  const mesAnterior = somarMeses(mes, -1);
  const totalMesAnterior = despesaRealizadaMes(
    itens,
    despesasFixas,
    parcelas,
    veiculo,
    mesAnterior,
    mesReal,
    hojeIso(),
  );
  const variacao = variacaoMensal(totalDoMesComVeiculo, totalMesAnterior);

  // "Média (3 meses)": os três meses ANTERIORES ao exibido, sem o incluir —
  // mesmo cartão e mesma razão do irmão em Receitas. O mês em curso está quase
  // sempre pela metade, e incluí-lo fazia a referência afundar todo dia 1 e
  // subir ao longo do mês; o cartão existe justamente para dar um número
  // estável contra o qual ler o mês de agora. Substitui uma contagem de
  // lançamentos que só repetia, em número, a lista logo abaixo.
  //
  // Cada mês entra pelo MESMO total do cartão "Total do mês" — as quatro
  // parcelas de `despesaRealizadaMes` —, senão comparava-se um número com
  // outro de base diferente, que é o defeito que ff91a39 corrigiu nesta tela.
  // Fica sempre mensal, mesmo com "Semana" escolhida: três semanas são amostra
  // pequena demais, igual ao que já vale para "Maior categoria" e "vs mês
  // passado".
  const media = mediaDeMeses(
    mesesRecentes(3, mesAnterior),
    primeiroMesComDespesa(itens, despesasFixas, parcelas, veiculo),
    (m) => despesaRealizadaMes(itens, despesasFixas, parcelas, veiculo, m, mesReal, hojeIso()),
  );

  // Semanas do mês exibido; trocar de mês reposiciona na semana de hoje (ou
  // na ponta mais perto dela, quando hoje está fora do mês — ver `indiceDaSemana`).
  const semanas = semanasDoMes(mes, cfg.diaInicioSemana);
  const idxPadrao = indiceDaSemana(semanas, hojeIso());
  const [mesDaSemana, setMesDaSemana] = useState(mes);
  if (mesDaSemana !== mes) {
    setMesDaSemana(mes);
    setSemanaIdx(idxPadrao);
  }
  const semanaAtual = semanas[Math.min(semanaIdx, semanas.length - 1)];
  const fixasVisiveis = despesasFixas.filter((f) => fixaAtivaNoMes(f, mes));
  const doPeriodo =
    visao === "semana" && semanaAtual ? naSemana(itens, semanaAtual) : doMes(itens, mes);

  // Com "Semana" escolhida, o primeiro KPI passa a falar da semana — o mesmo
  // total que o rodapé da lista já mostrava lá em baixo. Só na aba Correntes:
  // é lá que vive o alternador Mês/Semana, e os KPIs agora ficam fora das
  // abas. Os outros três continuam sempre mensais — uma semana é amostra
  // pequena demais para as perguntas que eles fazem.
  const porSemana = aba === "correntes" && visao === "semana" && semanaAtual !== undefined;
  const contadasDoPeriodo = despesasNosTotais(doPeriodo);
  const totalKpi = porSemana ? total(contadasDoPeriodo) : totalDoMesComVeiculo;

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

  // ---- caixa de despesa fixa (criar/editar na mesma folha — itens 2 e 7) ----
  const [dfAberta, setDfAberta] = useState(false);
  const [dfEditandoId, setDfEditandoId] = useState<Id | null>(null);
  const [dfDescricao, setDfDescricao] = useState("");
  const [dfNota, setDfNota] = useState("");
  const [dfValor, setDfValor] = useState<Cents | null>(null);
  const [dfCategoria, setDfCategoria] = useState("");
  const [dfContaCartao, setDfContaCartao] = useState("");
  const [dfDia, setDfDia] = useState("");
  const [dfInicio, setDfInicio] = useState("");
  const [dfFim, setDfFim] = useState("");
  const [dfAutoDebit, setDfAutoDebit] = useState(false);

  function abrirNovaFixa() {
    setDfEditandoId(null);
    setDfDescricao("");
    setDfNota("");
    setDfValor(null);
    setDfCategoria(cfg.categoriasDespesa[0] ?? "");
    setDfContaCartao("");
    setDfDia("");
    setDfInicio("");
    setDfFim("");
    setDfAutoDebit(false);
    setDfAberta(true);
  }

  function abrirEdicaoFixa(f: DespesaFixa) {
    setDfEditandoId(f.id);
    setDfDescricao(f.descricao);
    setDfNota(f.nota ?? "");
    setDfValor(f.valor);
    setDfCategoria(f.categoria);
    setDfContaCartao(f.contaCartao ?? "");
    setDfDia(f.diaVencimento ? String(f.diaVencimento) : "");
    setDfInicio(f.inicio ?? "");
    setDfFim(f.fim ?? "");
    setDfAutoDebit(!!f.autoDebit);
    setDfAberta(true);
  }

  async function salvarFixa(e: FormEvent) {
    e.preventDefault();
    const valor = dfValor;
    if (valor === null || valor <= 0) return mostrarToast("Valor inválido.");
    if (!dfDescricao.trim()) return mostrarToast("Nome obrigatório.");
    const dia = dfDia.trim() === "" ? undefined : Number(dfDia);
    if (dia !== undefined && (!Number.isInteger(dia) || dia < 1 || dia > 31))
      return mostrarToast("Dia do vencimento deve ser entre 1 e 31.");
    const dados = {
      descricao: dfDescricao,
      nota: dfNota.trim() || undefined,
      valor,
      categoria: dfCategoria || cfg.categoriasDespesa[0] || "Outros",
      contaCartao: dfContaCartao || undefined,
      diaVencimento: dia,
      inicio: dfInicio || undefined,
      fim: dfFim || undefined,
      // Só anotação: nenhum total olha para isto (ver o tipo `DespesaFixa`).
      // `undefined` quando desligado porque `atualizar` grava com `set` — a
      // chave sai do registo em vez de ficar um `false` pendurado.
      autoDebit: dfAutoDebit || undefined,
    };
    if (dfEditandoId) {
      const atual = despesasFixas.find((f) => f.id === dfEditandoId);
      if (!atual) return;
      await agir(
        () => atualizarDespesaFixa(uid!, { ...atual, ...dados }),
        "✓ Despesa fixa atualizada",
      );
    } else {
      await agir(
        () => criarDespesaFixa(uid!, { ...dados, pagoPorMes: {} }),
        "✓ Despesa fixa criada",
      );
    }
    setDfAberta(false);
  }

  async function excluirFixa() {
    const atual = despesasFixas.find((f) => f.id === dfEditandoId);
    if (!atual) return;
    if (!(await confirmar(`Excluir "${atual.descricao}"?`))) return;
    setDfAberta(false);
    await agir(() => removerDespesaFixa(uid!, atual.id), "Despesa fixa excluída");
  }

  return (
    <Pagina titulo="Despesas">
      {/* Fora das abas: os três já contam fixas, parcelas e veículo (ver o
          cálculo de `totalDoMesComVeiculo`), portanto valem tanto numa aba
          como na outra — e desapareciam ao passar para "Fixas". Mesma ordem
          de Veiculo e Tvde: KPIs primeiro, abas depois. */}
      <Kpis pagina="despesas">
        {/* O sub não é enfeite: este cartão soma quatro coisas (correntes +
            fixas + parcelas + veículo) e o rodapé da lista lá em baixo soma
            só as correntes visíveis. Eram dois números diferentes com a mesma
            palavra "Total" na mesma tela — quem olhava só via a contradição.
            Aqui diz-se o que entra; lá em baixo diz-se que é só daquela lista. */}
        <KpiCard
          rotulo={porSemana ? "Total da semana" : "Total do mês"}
          chave="Total do mês"
          valor={formatMoney(totalKpi, moeda)}
          sub={
            porSemana && semanaAtual
              ? rotuloDaSemana(semanaAtual)
              : "inclui fixas, parcelas e veículo"
          }
          tom="vermelho"
        />
        {/* O valor manda, o nome é o detalhe: numa fila de quatro cartões que
            mostram todos dinheiro, o único que mostrava uma palavra obrigava a
            parar e reler para saber o que estava a ver. */}
        <KpiCard
          rotulo="Maior categoria"
          valor={maiorCategoria ? formatMoney(maiorCategoria.valor, moeda) : "—"}
          sub={
            maiorCategoria
              ? `${maiorCategoria.categoria}${
                  statusMaiorCategoria?.estourado
                    ? " — estourou o teto"
                    : pertoMaiorCategoria
                      ? " — perto do teto"
                      : ""
                }`
              : undefined
          }
          tom={
            statusMaiorCategoria?.estourado
              ? "vermelho"
              : pertoMaiorCategoria
                ? "amarelo"
                : "neutro"
          }
        />
        {/* Aqui subir é mau: o verde/vermelho é o contrário do mesmo cartão em
            Receitas. */}
        <KpiCard
          rotulo="vs mês passado"
          valor={
            variacao === null ? (totalDoMesComVeiculo > 0 ? "Novo" : "—") : rotuloVariacao(variacao)
          }
          sub={`${rotuloMes(mesAnterior)}: ${formatMoney(totalMesAnterior, moeda)}`}
          tom={variacao === null || variacao === 0 ? "neutro" : variacao > 0 ? "vermelho" : "verde"}
        />
        {/* Mesmo cartão, mesmas palavras e mesmo tom do de Receitas: os dois
            respondem à mesma pergunta em lados opostos da conta. */}
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
          tom="laranja"
        />
      </Kpis>

      <div className={styles.abas} role="tablist" {...propsLista}>
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            role="tab"
            id={idAba(id)}
            aria-selected={aba === id}
            aria-controls={idPainelAba(id)}
            {...propsAba(id)}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      <AbaTransicao aba={aba}>
        {aba === "correntes" && (
          <>
            <div className={styles.linhaVisao}>
              <div className={styles.alternadorVisao} role="radiogroup" aria-label="Período">
                {(
                  [
                    ["mes", "Mês"],
                    ["semana", "Semana"],
                  ] as const
                ).map(([id, nome]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={visao === id}
                    className={`${styles.visaoBotao} ${visao === id ? styles.visaoAtiva : ""}`}
                    onClick={() => setVisao(id)}
                  >
                    {nome}
                  </button>
                ))}
              </div>
              {visao === "semana" && (
                <SeletorSemana semanas={semanas} indice={semanaIdx} aoMudar={setSemanaIdx} />
              )}
              {/* Já se está na aba "Correntes" — o título "Despesas correntes"
                  do cartão de baixo era redundante. O botão sobe pra cá. */}
              <button
                className={styles.botaoAdicionarTopo}
                onClick={() => abrirRegistro("despesa")}
              >
                <Plus size={15} aria-hidden /> Adicionar
              </button>
            </div>

            <SeletorOrdem valor={ordem} aoMudar={setOrdem} />

            <ListaLancamentos
              /* key: trocar de mês ou de ordem remonta a lista e volta pra página 1 */
              key={`${mes}-${ordem}-${visao}-${semanaIdx}`}
              itens={[...doPeriodo].sort(compararPorOrdem(ordem)).map((d) => {
                // A conta do líquido é feita contra o mês INTEIRO (`itens`) e
                // não contra `doPeriodo`: na visão por semana, o reembolso
                // costuma cair noutra semana que não a do jantar, e limitá-lo
                // ao período mostrava a despesa como se ninguém a tivesse
                // devolvido.
                const liq = liquidoDaDespesa(d, itens);
                return {
                  id: d.id,
                  descricao: d.descricao,
                  valor: d.valor,
                  data: d.data,
                  etiqueta: d.nota ? `${d.categoria} · ${d.nota}` : d.categoria,
                  categoria: d.categoria,
                  sub: liq.temReembolso
                    ? `${formatMoney(liq.bruto, moeda)} − ${formatMoney(liq.reembolsado, moeda)} reembolsado = ${formatMoney(liq.liquido, moeda)} líquido`
                    : undefined,
                };
              })}
              carregado={carregado}
              erro={erroDespesas}
              tom="vermelho"
              moeda={moeda}
              /* "Soma desta lista", e não "Total <mês>": este rodapé conta só
                 as despesas CORRENTES do período — o que está mesmo à vista
                 nesta aba — enquanto o KPI "Total do mês" lá em cima conta
                 também fixas, parcelas e veículo. Chamar os dois de "Total"
                 fazia a mesma tela mostrar € 85,30 e € 542,97 lado a lado sem
                 dizer que somam coisas diferentes. (A soma é sempre de TODAS
                 as linhas do período, não só da página aberta do paginador.) */
              rotuloTotal={
                visao === "semana" && semanaAtual
                  ? `Soma desta lista · ${rotuloDaSemana(semanaAtual)}`
                  : `Soma desta lista · ${rotuloMes(mes)}`
              }
              /* A lista mostra pagamento de fatura e espelho de parcela, mas o
                 rodapé soma só o que conta nos totais — igual aos KPIs acima. */
              total={total(despesasNosTotais(doPeriodo))}
              vazio={
                visao === "semana" && semanaAtual
                  ? `Nenhuma despesa em ${rotuloDaSemana(semanaAtual)}`
                  : `Nenhuma despesa em ${rotuloMes(mes)}`
              }
              vazioSub="Toque em Adicionar para lançar a primeira."
              vazioIcone={TrendingDown}
              aoAdicionar={() => abrirRegistro("despesa")}
              aoEditar={editar}
            />
          </>
        )}

        {aba === "fixas" && (
          <>
            <div className={styles.cabecalhoLista}>
              <h3 className={styles.tituloSecao}>Despesas fixas</h3>
              <button className={styles.botaoAdicionar} onClick={abrirNovaFixa}>
                <Plus size={15} aria-hidden /> Adicionar despesa fixa
              </button>
            </div>

            <div className={styles.lista}>
              {erroFixas && fixasVisiveis.length > 0 && <ErroSincronizacao compacto />}
              {erroFixas && fixasVisiveis.length === 0 ? (
                <ErroSincronizacao />
              ) : fixasVisiveis.length === 0 ? (
                // Era um <p> solto, estilizado à parte, enquanto todas as outras
                // listas reais sem dados do app usam o EstadoVazio (ícone num
                // círculo + mensagem + sub). A distinção entre "nunca criaste
                // nenhuma" e "nenhuma vigora neste mês" mantém-se, e é ela que
                // decide o sub: uma leva a criar, a outra a mudar de mês.
                <EstadoVazio
                  Icone={Repeat}
                  mensagem={
                    despesasFixas.length === 0
                      ? "Nenhuma despesa fixa ainda"
                      : `Nenhuma despesa fixa em ${rotuloMes(mes)}`
                  }
                  sub={
                    despesasFixas.length === 0
                      ? "Toque em Adicionar despesa fixa para criar a primeira."
                      : "As já criadas começam ou terminam em outros meses."
                  }
                />
              ) : (
                fixasVisiveis.map((f) => {
                  // Débito automático segue a mesma regra do Resumo, do
                  // extrato de Transações e do sino: paga sozinha a partir do
                  // dia de vencimento, sem precisar tocar em nada — por isso
                  // o selo, aqui, também some como ação (ver `!f.autoDebit`
                  // abaixo), igual ao "Pagar" some numa parcela autoDebit.
                  const paga = fixaEfetivamentePaga(f, mes, mesAtual(), hojeIso());
                  return (
                    <div key={f.id} className={styles.item}>
                      {/* Linha inteira abre a caixa de edição (item 7); só o
                            selo Pago/Pendente continua com ação própria. */}
                      <button className={styles.itemCorpo} onClick={() => abrirEdicaoFixa(f)}>
                        <span className={styles.itemTexto}>
                          <span className={styles.itemNome}>{f.descricao}</span>
                          <span className={styles.itemDetalhe}>
                            {f.categoria}
                            {f.nota ? ` · ${f.nota}` : ""}
                            {f.contaCartao ? ` · ${f.contaCartao}` : ""}
                            {f.diaVencimento ? ` · dia ${f.diaVencimento}` : ""}
                            {f.autoDebit && (
                              <>
                                {" · "}
                                <span className={styles.marcaAutoDebit}>débito automático</span>
                              </>
                            )}
                          </span>
                        </span>
                        <span className={styles.itemValor}>{formatMoney(f.valor, moeda)}</span>
                      </button>
                      {f.autoDebit ? (
                        <span
                          className={`${styles.badgeToggle} ${styles.badgeAuto} ${paga ? styles.badgePago : styles.badgePendente}`}
                        >
                          {paga ? "Pago" : "Pendente"}
                        </span>
                      ) : (
                        <button
                          className={`${styles.badgeToggle} ${paga ? styles.badgePago : styles.badgePendente}`}
                          // Sem nome próprio, uma lista de oito fixas dava oito
                          // botões chamados "Pago"/"Pendente" e nada dizia a
                          // qual despesa cada um pertencia — o nome da fixa está
                          // no botão ao lado, que é outro elemento. O
                          // aria-pressed dá o estado; o rótulo diz de quem é.
                          aria-pressed={paga}
                          aria-label={`${f.descricao} — ${paga ? "pago" : "pendente"}`}
                          onClick={() =>
                            void agir(
                              () => alternarPagoDespesaFixa(uid!, f.id, mes, !paga),
                              paga ? "Marcado como pendente" : "✓ Pago",
                            )
                          }
                        >
                          {paga ? "Pago" : "Pendente"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Caixa única de despesa fixa: cria e edita (itens 2, 7, 11, 16, 17, 19) */}
      </AbaTransicao>
      <BottomSheet
        aberta={dfAberta}
        aoFechar={() => setDfAberta(false)}
        titulo={dfEditandoId ? "Editar despesa fixa" : "Nova despesa fixa"}
      >
        <form className={styles.formFolha} onSubmit={salvarFixa}>
          <label className={styles.campo}>
            Nome
            <input value={dfDescricao} onChange={(e) => setDfDescricao(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Descrição (opcional)
            <input value={dfNota} onChange={(e) => setDfNota(e.target.value)} />
          </label>
          <div className={styles.linhaDupla}>
            <label className={styles.campo}>
              Valor mensal
              <CampoMoeda valor={dfValor} aoMudar={setDfValor} required />
            </label>
            <label className={styles.campo}>
              Dia do vencimento
              <input
                inputMode="numeric"
                placeholder="1-31"
                value={dfDia}
                onChange={(e) => setDfDia(e.target.value)}
              />
            </label>
          </div>
          <SeletorCategoria
            valor={dfCategoria}
            opcoes={cfg.categoriasDespesa}
            aoMudar={setDfCategoria}
          />
          <Seletor
            rotulo="Conta/cartão (opcional — se for crédito, entra na fatura)"
            valor={dfContaCartao}
            opcoes={cfg.contasCartoes}
            aoMudar={setDfContaCartao}
            rotuloOpcao={(c) => (cfg.tipoCartao[c] === "credit" ? `${c} · crédito` : c)}
            rotuloVazio="Sem conta"
          />
          <div className={styles.linhaDupla}>
            <label className={styles.campo}>
              Início (opcional)
              <input type="month" value={dfInicio} onChange={(e) => setDfInicio(e.target.value)} />
            </label>
            <label className={styles.campo}>
              Fim (opcional)
              <input type="month" value={dfFim} onChange={(e) => setDfFim(e.target.value)} />
            </label>
          </div>
          {/* Mesmo botão-marcação do parcelamento no Registro Rápido. Aqui é só
              uma anotação: a fixa já entra na fatura por ser de cartão de
              crédito, ligar ou desligar isto não move nenhum total. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={dfAutoDebit}
            className={`${styles.marcacao} ${dfAutoDebit ? styles.marcacaoAtiva : ""}`}
            onClick={() => setDfAutoDebit(!dfAutoDebit)}
          >
            {dfAutoDebit ? <SquareCheck size={18} aria-hidden /> : <Square size={18} aria-hidden />}
            Débito automático
          </button>
          <button type="submit" className={styles.salvar}>
            {dfEditandoId ? "Salvar alterações" : "Criar fixa"}
          </button>
          {dfEditandoId && (
            <button type="button" className={styles.excluir} onClick={() => void excluirFixa()}>
              Excluir despesa fixa
            </button>
          )}
        </form>
      </BottomSheet>
    </Pagina>
  );
}
