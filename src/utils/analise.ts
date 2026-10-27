// A página Análise: tudo o que ela mostra, calculado aqui com as contas que o
// resto do app já usa — nada de fórmulas paralelas.
//
//  - receitas/despesas de cada mês: `resultadoDoMes`, o MESMO quadro "Resultado
//    do mês" da Início (fluxo de caixa);
//  - taxa de poupança: `taxaPoupanca`, a do KPI de Planejamento → Metas;
//  - média: `mediaDeMeses`, a do "Média (3 meses)" de Despesas/Receitas — só
//    conta os meses ANTES do atual e só os que já tinham história;
//  - semanas: `semanasDoMes`/`naSemana`, as do Calendário e das Despesas;
//  - categorias: `despesaPorCategoriaRegistradaMes`, a da folha "Categorias";
//  - maiores gastos: `transacoesDoMes`, a fonte dos "Últimos movimentos".

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  Receita,
  Transferencia,
  YearMonth,
} from "../types";
import {
  diaDoMes,
  diasDoMes,
  mediaDeMeses,
  mesDe,
  mesesRecentes,
  receitasNosTotais,
  somarMeses,
  variacaoMensal,
} from "./calculos";
import { despesaPorCategoriaRegistradaMes } from "./despesaPorCategoria";
import { taxaPoupancaReal } from "./metas";
import { resultadoDoMes } from "./resumoMensal";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "./semanas";
import { entraDinheiro, transacoesDoMes, type Transacao } from "./transacoes";

export type PeriodoAnalise = 3 | 6 | 12;
export const PERIODOS_ANALISE: PeriodoAnalise[] = [3, 6, 12];

export interface DadosAnalise {
  receitas: Receita[];
  despesasCorrentes: DespesaCorrente[];
  despesasFixas: DespesaFixa[];
  parcelas: Parcela[];
  transferencias: Transferencia[];
  veiculo: DadosVeiculo;
}

export interface PontoMes {
  mes: YearMonth;
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
  /** Pode ser negativa (gastou mais do que recebeu); `null` sem receita. */
  taxa: number | null;
}

/** Como um número se compara com a sua média. A percentagem só diz alguma
 *  coisa com uma base que se aguente: com a média abaixo de € 50, ou quando o
 *  valor muda de sinal (um mês de sobra negativa contra uma média positiva),
 *  "▼ 535%" não quer dizer nada — aí a variação vai em euros. A sobra mostra
 *  sempre euros. `pct` e `euros` nunca vêm os dois; sem média, nenhum.
 *  `sentido` é o lado da variação; `pior` diz se é má notícia (para despesa
 *  subir é pior, para receita e sobra é descer), `null` sem variação. */
export interface Variacao {
  pct: number | null;
  euros: Cents | null;
  sentido: -1 | 0 | 1 | null;
  pior: boolean | null;
}

export interface Comparacao extends Variacao {
  atual: Cents;
  media: Cents | null;
}

export interface LinhaCategoria extends Variacao {
  categoria: string;
  atual: Cents;
  /** Um valor por mês da janela (com história), do mais antigo ao atual. */
  serie: Cents[];
}

export interface BarraSemana {
  rotulo: string;
  intervalo: string;
  valor: Cents;
  estado: "passada" | "atual" | "futura";
}

export interface GastoGrande {
  chave: string;
  titulo: string;
  data: IsoDate;
  categoria: string | undefined;
  valor: Cents;
}

export interface AnaliseMes {
  /** Sem nenhum dado até ao mês escolhido: a página mostra o estado vazio. */
  vazio: boolean;
  /** Meses da janela que já tinham história, do mais antigo ao atual. */
  meses: PontoMes[];
  taxa: {
    atual: number | null;
    /** Média das taxas mensais da janela (só meses com receita). */
    media: number | null;
    guardou: Cents;
    /** Quanto se gastou a mais do que se recebeu (0 quando sobrou). */
    gastouAMais: Cents;
    receitas: Cents;
  };
  /** Quantos meses entraram na média ("o mês atual vs a sua média"). */
  mesesNaMedia: number;
  vsMedia: { despesas: Comparacao; receitas: Comparacao; sobra: Comparacao };
  semanas: { barras: BarraSemana[]; media: Cents | null };
  categorias: LinhaCategoria[];
  maioresGastos: GastoGrande[];
}

/** Quantas categorias a lista "Categorias mês a mês" mostra. */
export const CATEGORIAS_NA_ANALISE = 4;
const GASTOS_GRANDES = 3;

/** O primeiro mês em que há qualquer dado, de receita ou de despesa — o
 *  começo da história para a Análise. Ao contrário de `primeiroMesComDespesa`,
 *  uma fixa sem `inicio` não conta como "desde sempre": aqui o que interessa é
 *  desde quando há números para mostrar. `null` sem dados nenhuns. */
export function primeiroMesDeDados(d: DadosAnalise): YearMonth | null {
  const meses: YearMonth[] = [
    ...receitasNosTotais(d.receitas).map((r) => mesDe(r.data)),
    ...d.despesasCorrentes
      .filter((x) => x.origem !== "fat" && x.origem !== "recon")
      .map((x) => mesDe(x.data)),
    ...d.veiculo.cargas.map((c) => mesDe(c.data)),
    ...d.veiculo.despesas.map((x) => mesDe(x.data)),
    ...d.parcelas.map((p) => p.primeiroMes),
    ...[...d.despesasFixas, ...d.veiculo.despesasFixas].flatMap((f) =>
      f.inicio ? [f.inicio] : [],
    ),
  ];
  return meses.length === 0 ? null : meses.reduce((min, m) => (m < min ? m : min));
}

/** Abaixo disto a média é pequena demais para uma percentagem. */
const MEDIA_MINIMA_PARA_PCT: Cents = 5000;

const SEM_VARIACAO: Variacao = { pct: null, euros: null, sentido: null, pior: null };

export function variarContraMedia(
  atual: Cents,
  media: Cents | null,
  subirEPior: boolean,
  soEuros = false,
): Variacao {
  if (media === null) return SEM_VARIACAO;
  const delta = atual - media;
  const mudaDeSinal = atual * media < 0;
  const emEuros = soEuros || Math.abs(media) < MEDIA_MINIMA_PARA_PCT || mudaDeSinal;
  const pctBruto = emEuros ? null : variacaoMensal(atual, media);
  // Sem base para a percentagem (média negativa), cai para euros.
  const emEurosFinal = emEuros || pctBruto === null;
  const pct = emEurosFinal ? null : pctBruto;
  // Em euros, uma diferença que arredonda a € 0 é "igual", sem seta.
  const medida = emEurosFinal ? Math.round(delta / 100) : (pct as number);
  const sentido: -1 | 0 | 1 = medida === 0 ? 0 : medida > 0 ? 1 : -1;
  return {
    pct,
    euros: emEurosFinal ? Math.abs(delta) : null,
    sentido,
    pior: sentido === 0 ? null : subirEPior ? sentido > 0 : sentido < 0,
  };
}

function comparar(
  atual: Cents,
  media: Cents | null,
  subirEPior: boolean,
  soEuros = false,
): Comparacao {
  return { atual, media, ...variarContraMedia(atual, media, subirEPior, soEuros) };
}

/** Os movimentos de SAÍDA do mês que contam como gasto: sem transferências
 *  entre contas (o dinheiro não saiu de si) nem pagamentos de fatura (as
 *  compras que a formaram já aparecem com a sua própria data) nem reembolsos. */
function gastosDoMes(
  d: DadosAnalise,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje: IsoDate,
  nomeDaConta?: (id: string) => string,
): Transacao[] {
  const faturas = new Set(d.despesasCorrentes.filter((x) => x.origem === "fat").map((x) => x.id));
  return transacoesDoMes(d, ym, mesReal, hoje, nomeDaConta).filter(
    (t) =>
      t.origem !== "transferencia" &&
      !(t.origem === "despesa" && faturas.has(t.refId)) &&
      !entraDinheiro(t) &&
      t.valor > 0,
  );
}

function media(valores: number[]): number | null {
  return valores.length === 0
    ? null
    : Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
}

/** O dia de referência de "agora" dentro do mês escolhido: hoje, se o mês é o
 *  de hoje; o último dia, se já passou; o primeiro, se ainda não chegou. */
function diaDeReferencia(ym: YearMonth, mesReal: YearMonth, hoje: IsoDate): IsoDate {
  if (ym === mesReal) return hoje;
  return ym < mesReal ? diaDoMes(ym, diasDoMes(ym)) : diaDoMes(ym, 1);
}

export function analisarMes(
  d: DadosAnalise,
  config: { diaInicioSemana: number },
  mes: YearMonth,
  mesReal: YearMonth,
  hoje: IsoDate,
  periodo: PeriodoAnalise,
  nomeDaConta?: (id: string) => string,
): AnaliseMes {
  const primeiro = primeiroMesDeDados(d);
  const resultado = (ym: YearMonth) =>
    resultadoDoMes(d.receitas, d.despesasCorrentes, d.despesasFixas, d.veiculo, ym, mesReal, hoje);

  const vazioBase: AnaliseMes = {
    vazio: true,
    meses: [],
    taxa: { atual: null, media: null, guardou: 0, gastouAMais: 0, receitas: 0 },
    mesesNaMedia: 0,
    vsMedia: {
      despesas: comparar(0, null, true),
      receitas: comparar(0, null, false),
      sobra: comparar(0, null, false),
    },
    semanas: { barras: [], media: null },
    categorias: [],
    maioresGastos: [],
  };
  if (primeiro === null || mes < primeiro) return vazioBase;

  // Janela: os `periodo` meses que terminam no escolhido, sem os que ainda não
  // tinham história (um zero de antes de existir app não é um zero verdadeiro).
  const janela = mesesRecentes(periodo, mes).filter((m) => m >= primeiro);
  const meses: PontoMes[] = janela.map((m) => {
    const r = resultado(m);
    return { mes: m, ...r, taxa: taxaPoupancaReal(r.receitas, r.saldo) };
  });
  const atual = meses[meses.length - 1];

  const taxas = meses.flatMap((p) => (p.taxa === null ? [] : [p.taxa]));
  const taxa = {
    atual: atual.taxa,
    media: media(taxas),
    guardou: Math.max(0, atual.saldo),
    gastouAMais: Math.max(0, -atual.saldo),
    receitas: atual.receitas,
  };

  // Média dos `periodo` meses ANTES do atual, como o "Média (3 meses)".
  const antes = mesesRecentes(periodo, somarMeses(mes, -1));
  const mediaDe = (valor: (ym: YearMonth) => Cents) => mediaDeMeses(antes, primeiro, valor);
  const mDespesas = mediaDe((m) => resultado(m).despesas);
  const mReceitas = mediaDe((m) => resultado(m).receitas);
  const mSobra = mediaDe((m) => resultado(m).saldo);
  const vsMedia = {
    despesas: comparar(atual.despesas, mDespesas?.media ?? null, true),
    receitas: comparar(atual.receitas, mReceitas?.media ?? null, false),
    sobra: comparar(atual.saldo, mSobra?.media ?? null, false, true),
  };

  // Semanas do mês, a partir dos mesmos movimentos de saída.
  const gastos = gastosDoMes(d, mes, mesReal, hoje, nomeDaConta);
  const semanas = semanasDoMes(mes, config.diaInicioSemana);
  const agora = diaDeReferencia(mes, mesReal, hoje);
  const iAtual = indiceDaSemana(semanas, agora);
  const barras: BarraSemana[] = semanas.map((s, i) => ({
    rotulo: `S${i + 1}`,
    intervalo: rotuloDaSemana(s),
    valor: naSemana(gastos, s).reduce((soma, t) => soma + t.valor, 0),
    estado: i === iAtual ? "atual" : s.inicio > agora ? "futura" : "passada",
  }));
  const jaComecaram = barras.filter((b) => b.estado !== "futura").map((b) => b.valor);

  // Categorias: as maiores do mês atual, com a série da janela.
  const fatiasPorMes = janela.map((m) =>
    despesaPorCategoriaRegistradaMes(
      d.despesasCorrentes,
      d.despesasFixas,
      d.veiculo,
      m,
      mesReal,
      hoje,
    ),
  );
  const fatiasAtual = fatiasPorMes[fatiasPorMes.length - 1];
  const categorias: LinhaCategoria[] = fatiasAtual.slice(0, CATEGORIAS_NA_ANALISE).map((f) => {
    const serie = fatiasPorMes.map((fs) => fs.find((x) => x.categoria === f.categoria)?.valor ?? 0);
    const mediaAntes = media(serie.slice(0, -1));
    return {
      categoria: f.categoria,
      atual: f.valor,
      serie,
      ...variarContraMedia(f.valor, mediaAntes, true),
    };
  });

  const maioresGastos = [...gastos]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, GASTOS_GRANDES)
    .map((t) => ({
      chave: t.chave,
      titulo: t.titulo,
      data: t.data,
      categoria: t.categoria,
      valor: t.valor,
    }));

  return {
    vazio: false,
    meses,
    taxa,
    mesesNaMedia: mDespesas?.meses ?? 0,
    vsMedia,
    semanas: { barras, media: media(jaComecaram) },
    categorias,
    maioresGastos,
  };
}
