// Motor de fatos e planeamento do Copiloto.
//
//   dados reais → [ESTE FICHEIRO: números] → [copiloto.ts: palavras] → tela
//
// Tudo o que envolve aritmética acontece aqui, é determinístico e é testável
// sem rede nenhuma. Nada neste ficheiro chama serviços externos: chegou a
// existir a ideia de mandar este resumo a uma IA para ela o reescrever com
// mais jeito, mas isso foi cancelado por custo enquanto a app não é
// comercial. A separação ficou na mesma, porque continua a valer por si — o
// que a app AFIRMA sobre o dinheiro de alguém não se mistura com a forma
// como o diz.

import type { Cents, Currency, Id, YearMonth } from "../types";
import { mesDe, somarDias, somarMeses } from "./calculos";
import { proximosEventos } from "./calendario";
import { calcularFatura } from "./fatura";
import {
  categoriasDoMes,
  dadosFaturaDoContexto,
  escaparHtml,
  mediasPorCategoria,
  normalizarPergunta,
  progressoFundo,
  totaisDoMes,
  type ContextoCopiloto,
  type MediaCategoria,
  type ProgressoFundo,
} from "./copiloto";
import { formatMoney } from "./money";
import { vencimentosDeFaturas, vencimentosDeFixas, vencimentosDeParcelas } from "./vencimentos";

/** Um compromisso já datado dentro da janela de 30 dias. */
export interface CompromissoPrevisto {
  tipo: "fixa" | "parcela" | "fatura" | "evento";
  dia: string;
  titulo: string;
  valor: Cents;
}

export interface OrcamentoCategoria {
  categoria: string;
  teto: Cents;
  gasto: Cents;
  restante: Cents;
  /** Pode passar de 100 — é justamente o caso que interessa mostrar. */
  pctUsado: number;
  estourou: boolean;
}

/** Retrato estruturado da conta. Números, nunca texto: é o que separa o que a
 *  app sabe do que a IA escreve. */
export interface FinanceSnapshot {
  mes: YearMonth;
  moeda: Currency;
  diaDeHoje: number;
  /** Saldos iniciais + tudo o que entrou − tudo o que saiu, ao longo de todos
   *  os meses com movimento. */
  saldoDisponivel: Cents;
  receitasDoMes: Cents;
  despesasDoMes: Cents;
  saldoDoMes: Cents;
  /** Compromissos datados nos próximos 30 dias, já ordenados. */
  proximos30Dias: CompromissoPrevisto[];
  totalAPagar30Dias: Cents;
  orcamento: OrcamentoCategoria[];
  fundos: ProgressoFundo[];
  medias: MediaCategoria[];
  metaPoupanca: Cents;
}

/** Todos os meses entre o primeiro e o último movimento, para o saldo
 *  acumulado não depender de um intervalo inventado. */
function mesesComMovimento(ctx: ContextoCopiloto): YearMonth[] {
  const datas: string[] = [
    ...ctx.receitas.map((r) => r.data),
    ...ctx.despesas.map((d) => d.data),
    ...ctx.veiculo.cargas.map((c) => c.data),
    ...ctx.veiculo.despesas.map((d) => d.data),
  ];
  const meses = datas.map((d) => d.slice(0, 7));
  // Fixas e parcelas não têm data única: contribuem por plano, mês a mês.
  // Cobri-las exige varrer desde o primeiro movimento até hoje de qualquer
  // forma, que é o que o intervalo abaixo faz.
  const primeiro = meses.length ? meses.reduce((a, m) => (m < a ? m : a)) : ctx.mesReal;
  const ultimo = ctx.mesReal;

  const lista: YearMonth[] = [];
  let m = primeiro < ultimo ? primeiro : ultimo;
  // Guarda de sanidade: uma data corrompida no passado remoto não pode fazer
  // isto correr para sempre.
  for (let i = 0; m <= ultimo && i < 600; i++) {
    lista.push(m);
    m = somarMeses(m, 1);
  }
  return lista;
}

function saldoAcumulado(ctx: ContextoCopiloto): Cents {
  const inicial = Object.values(ctx.cfg.saldosIniciais).reduce((s, v) => s + v, 0);
  let saldo = inicial;
  for (const ym of mesesComMovimento(ctx)) {
    const t = totaisDoMes(ctx, ym);
    saldo += t.receitas - t.despesas;
  }
  return saldo;
}

/** Compromissos com data marcada entre hoje e hoje+30, atravessando a virada
 *  do mês — uma fatura que vence no dia 5 do mês seguinte está dentro da
 *  janela e tem de aparecer, senão o plano do mês ignora justamente a maior
 *  saída que aí vem. */
function compromissosProximos30Dias(ctx: ContextoCopiloto, hoje: string): CompromissoPrevisto[] {
  const limite = somarDias(hoje, 30);
  // Normalmente é o mês corrente + o seguinte, mas hoje perto do fim de um mês
  // curto (ex. 31 de janeiro) empurra o limite para um TERCEIRO mês (2 de
  // março) — parar em mesReal+1 perdia justamente o vencimento mais distante
  // dentro da própria janela.
  const mesLimite = mesDe(limite);
  const meses: YearMonth[] = [];
  for (let m = ctx.mesReal; m <= mesLimite; m = somarMeses(m, 1)) meses.push(m);
  const dados = dadosFaturaDoContexto(ctx);
  const cartoesCredito = ctx.cfg.contasCartoes.filter((c) => ctx.cfg.tipoCartao[c] === "credit");

  const itens: CompromissoPrevisto[] = [];

  for (const ym of meses) {
    const restantes = cartoesCredito
      .map((cartao) => ({
        cartao,
        restante: calcularFatura(cartao, ym, dados, ctx.cfg).restante,
      }))
      .filter((f) => f.restante > 0);

    const vencimentos = [
      ...vencimentosDeFixas(ctx.despesasFixas, ym, ctx.mesReal, hoje),
      ...vencimentosDeParcelas(ctx.parcelas, ym, ctx.cfg.diaVencimentoFatura, ctx.mesReal, hoje),
      ...vencimentosDeFaturas(restantes, ym, ctx.cfg.diaVencimentoFatura),
    ];

    for (const v of vencimentos) {
      if (v.dia < hoje || v.dia > limite) continue;
      itens.push({ tipo: v.tipo, dia: v.dia, titulo: v.titulo, valor: v.valor });
    }
  }

  for (const e of proximosEventos(ctx.eventos, hoje, 30)) {
    if (e.valor === undefined) continue;
    itens.push({ tipo: "evento", dia: e.data, titulo: e.titulo, valor: e.valor });
  }

  return itens.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
}

function estadoDoOrcamento(ctx: ContextoCopiloto, ym: YearMonth): OrcamentoCategoria[] {
  const gastos = categoriasDoMes(ctx, ym);
  return Object.keys(ctx.cfg.orcamentos)
    .filter((c) => ctx.cfg.orcamentos[c] > 0)
    .map((categoria) => {
      const teto = ctx.cfg.orcamentos[categoria];
      const gasto = gastos[categoria] ?? 0;
      return {
        categoria,
        teto,
        gasto,
        restante: teto - gasto,
        pctUsado: Math.round((gasto / teto) * 100),
        estourou: gasto > teto,
      };
    })
    .sort((a, b) => b.pctUsado - a.pctUsado);
}

export function buildFinanceSnapshot(ctx: ContextoCopiloto): FinanceSnapshot {
  const ym = ctx.mesReal;
  const hoje = `${ym}-${String(ctx.diaDeHoje).padStart(2, "0")}`;
  const t = totaisDoMes(ctx, ym);
  const proximos = compromissosProximos30Dias(ctx, hoje);

  return {
    mes: ym,
    moeda: ctx.cfg.currency,
    diaDeHoje: ctx.diaDeHoje,
    saldoDisponivel: saldoAcumulado(ctx),
    receitasDoMes: t.receitas,
    despesasDoMes: t.despesas,
    saldoDoMes: t.receitas - t.despesas,
    proximos30Dias: proximos,
    totalAPagar30Dias: proximos.reduce((s, p) => s + p.valor, 0),
    orcamento: estadoDoOrcamento(ctx, ym),
    fundos: ctx.fundos.map((f) => progressoFundo(f, ym)),
    medias: mediasPorCategoria(ctx, ym),
    metaPoupanca: ctx.cfg.metaPoupanca,
  };
}

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

/** Uma ação que a app sabe mesmo executar. Só existe o que já tem serviço
 *  pronto: sugerir o que não se consegue fazer seria teatro. */
export type AcaoPlano = { tipo: "contribuirFundo"; fundoId: Id; nomeFundo: string; valor: Cents };

export interface PassoPlano {
  id: string;
  titulo: string;
  /** Por que este passo existe, em linguagem de gente. */
  porque: string;
  /** 1 = mais urgente. Ordena a lista. */
  prioridade: number;
  /** Os números que sustentam o passo. Nenhuma afirmação sem valor por trás —
   *  é isto que a tela mostra quando a pessoa pergunta "porquê?". */
  dados: { rotulo: string; valor: Cents }[];
  /** Presente só quando há uma ação real por detrás, sempre sujeita a
   *  confirmação explícita de quem usa. */
  acao?: AcaoPlano;
}

export interface CenarioPlano {
  id: "conservador" | "equilibrado" | "acelerar";
  titulo: string;
  descricao: string;
  /** Quanto separar este mês neste cenário. */
  separar: Cents;
  /** O que sobra depois de separar e de pagar o que vence em 30 dias. */
  sobra: Cents;
}

export interface Plano {
  passos: PassoPlano[];
  cenarios: CenarioPlano[];
  /** O que sobra hoje depois dos compromissos já datados — a base de tudo. */
  margem: Cents;
}

const MAX_PASSOS = 5;

/** Deriva passos concretos e três cenários a partir do snapshot. Zero IA,
 *  zero aleatoriedade: o mesmo snapshot dá sempre o mesmo plano. */
export function gerarPlano(snapshot: FinanceSnapshot): Plano {
  const margem = snapshot.saldoDisponivel - snapshot.totalAPagar30Dias;
  const passos: PassoPlano[] = [];

  // 1. O que vence primeiro, quando não há folga para o cobrir.
  const aPagar = snapshot.totalAPagar30Dias;
  if (aPagar > 0) {
    const descoberto = aPagar > snapshot.saldoDisponivel;
    passos.push({
      id: "reservar-compromissos",
      titulo: descoberto
        ? "Reforçar a conta antes dos débitos dos próximos 30 dias"
        : "Deixar reservado o que vence nos próximos 30 dias",
      porque: descoberto
        ? "O que está datado para os próximos 30 dias é maior do que o saldo disponível hoje."
        : "Separar agora o que já tem data evita usar esse dinheiro sem dar por isso.",
      prioridade: descoberto ? 1 : 3,
      dados: [
        { rotulo: "A pagar em 30 dias", valor: aPagar },
        { rotulo: "Saldo disponível", valor: snapshot.saldoDisponivel },
        { rotulo: descoberto ? "Em falta" : "Folga depois de reservar", valor: Math.abs(margem) },
      ],
    });
  }

  // 2. Orçamentos estourados — o mais estourado primeiro.
  for (const o of snapshot.orcamento.filter((x) => x.estourou).slice(0, 2)) {
    passos.push({
      id: `orcamento-${o.categoria}`,
      titulo: `Travar ${o.categoria} até ao fim do mês`,
      porque: `Já passou o teto de ${o.categoria} em ${o.pctUsado - 100}%.`,
      prioridade: 2,
      dados: [
        { rotulo: "Teto do mês", valor: o.teto },
        { rotulo: "Já gasto", valor: o.gasto },
        { rotulo: "Acima do teto", valor: -o.restante },
      ],
    });
  }

  // 3. Categorias claramente acima do costume, mesmo sem teto definido —
  //    é o que a média de vários meses acrescenta a olhar só para o mês.
  const acimaDoCostume = snapshot.medias.filter(
    (m) => m.desvioPct !== null && m.desvioPct >= 25 && m.desvio > 0,
  );
  for (const m of acimaDoCostume.slice(0, 2)) {
    // Sem teto definido não há nada a "estourar", mas há um hábito a mudar.
    if (snapshot.orcamento.some((o) => o.categoria === m.categoria && o.estourou)) continue;
    passos.push({
      id: `acima-media-${m.categoria}`,
      titulo: `Olhar para ${m.categoria}, que está acima do costume`,
      porque: `Está ${m.desvioPct}% acima da média dos últimos ${m.mesesUsados} meses.`,
      prioridade: 4,
      dados: [
        { rotulo: "Este mês", valor: m.gastoAtual },
        { rotulo: `Média de ${m.mesesUsados} meses`, valor: m.media },
        { rotulo: "Diferença", valor: m.desvio },
      ],
    });
  }

  // 4. Fundos com prazo — a única sugestão com ação executável.
  const fundosComPrazo = snapshot.fundos
    .filter((f) => !f.concluido && f.porMes !== null && f.porMes > 0)
    .sort((a, b) => (a.mesesRestantes ?? 0) - (b.mesesRestantes ?? 0));

  for (const f of fundosComPrazo.slice(0, 2)) {
    const valor = f.porMes!;
    // Só sugere mexer em dinheiro que existe. Sugerir separar o que não há
    // seria a app a dar um conselho que ela própria sabe ser impossível.
    const cabeNaMargem = valor <= Math.max(0, margem);
    passos.push({
      id: `fundo-${f.fundo.id}`,
      titulo: cabeNaMargem
        ? `Separar para ${f.fundo.nome}`
        : `${f.fundo.nome} pede mais do que a folga deste mês`,
      porque: cabeNaMargem
        ? `Faltam ${f.mesesRestantes} mês(es) para o prazo de ${f.fundo.nome}.`
        : `Para bater o prazo faltaria separar mais do que sobra depois dos compromissos.`,
      prioridade: cabeNaMargem ? 5 : 3,
      dados: [
        { rotulo: "Já guardado", valor: f.fundo.atual },
        { rotulo: "Alvo", valor: f.fundo.alvo },
        { rotulo: "Sugerido este mês", valor },
        { rotulo: "Folga disponível", valor: Math.max(0, margem) },
      ],
      acao: cabeNaMargem
        ? { tipo: "contribuirFundo", fundoId: f.fundo.id, nomeFundo: f.fundo.nome, valor }
        : undefined,
    });
  }

  // 5. Nada a apontar é uma resposta legítima — melhor do que inventar um
  //    problema para ter o que dizer.
  if (!passos.length) {
    passos.push({
      id: "sem-alertas",
      titulo: "Está tudo dentro do previsto",
      porque: "Não há compromissos a descoberto, tetos estourados nem prazos apertados.",
      prioridade: 5,
      dados: [
        { rotulo: "Saldo disponível", valor: snapshot.saldoDisponivel },
        { rotulo: "Saldo do mês", valor: snapshot.saldoDoMes },
      ],
    });
  }

  passos.sort((a, b) => a.prioridade - b.prioridade);

  return {
    passos: passos.slice(0, MAX_PASSOS),
    cenarios: gerarCenarios(snapshot, margem),
    margem,
  };
}

/** Três formas de usar a mesma folga — não três opiniões, três repartições do
 *  mesmo número. Nunca sugerem separar mais do que existe. */
function gerarCenarios(snapshot: FinanceSnapshot, margem: Cents): CenarioPlano[] {
  const folga = Math.max(0, margem);
  const pedidoPelosFundos = snapshot.fundos
    .filter((f) => !f.concluido && f.porMes !== null)
    .reduce((s, f) => s + (f.porMes ?? 0), 0);

  const conservador = Math.round(folga * 0.25);
  const equilibrado = Math.min(folga, Math.max(Math.round(folga * 0.5), snapshot.metaPoupanca));
  const acelerar = Math.min(folga, Math.max(pedidoPelosFundos, equilibrado));

  return [
    {
      id: "conservador",
      titulo: "Conservador",
      descricao: "Guarda pouco e deixa a maior parte da folga livre para imprevistos.",
      separar: conservador,
      sobra: folga - conservador,
    },
    {
      id: "equilibrado",
      titulo: "Equilibrado",
      descricao: "Guarda cerca de metade da folga, ou a meta de poupança se ela for maior.",
      separar: equilibrado,
      sobra: folga - equilibrado,
    },
    {
      id: "acelerar",
      titulo: "Acelerar metas",
      descricao: "Guarda o que os fundos com prazo pedem, até ao limite da folga.",
      separar: acelerar,
      sobra: folga - acelerar,
    },
  ];
}

// ---------------------------------------------------------------------------
// Pergunta ao plano
// ---------------------------------------------------------------------------

/** Pistas de que a pergunta quer o PRÓXIMO PASSO, não um número do passado —
 *  é o que separa "quanto gastei" (responderPergunta) de "o que eu faço
 *  agora". Só entra depois da camada 1 de sempre já ter tentado e falhado:
 *  ver a nota em `responderPlano`. */
const GATILHOS_PLANO =
  /\bplano\b|proximo passo|conselho|sugestao|algum alerta|o que (eu )?(devo|faco)( fazer)?/;

/** Traduz o passo mais urgente do plano (`gerarPlano`) em texto — a mesma
 *  fronteira texto/números que `responderPergunta` já respeita: aqui só se
 *  formata o que o motor de plano já calculou, nada é inventado nem somado
 *  de novo.
 *
 *  Vive nesta camada, e não dentro de `INTENTS_COPILOTO` (utils/copiloto.ts),
 *  porque `gerarPlano`/`buildFinanceSnapshot` importam DESTE módulo — pôr o
 *  intent lá criaria um import circular entre os dois ficheiros. Continua a
 *  ser camada 1: zero rede, zero IA. Quem chama tenta isto DEPOIS de
 *  `responderPergunta` devolver `RESPOSTA_PADRAO` e ANTES de ir à camada 2,
 *  pela mesma razão de sempre — um número/plano que a app já tem vale mais
 *  do que texto gerado. */
export function responderPlano(pergunta: string, ctx: ContextoCopiloto): string | null {
  const q = normalizarPergunta(pergunta);
  if (!GATILHOS_PLANO.test(q)) return null;

  const passo = gerarPlano(buildFinanceSnapshot(ctx)).passos[0];
  const moeda = ctx.cfg.currency;
  const dados = passo.dados
    .slice(0, 2)
    .map((d) => `${d.rotulo}: ${formatMoney(d.valor, moeda)}`)
    .join(", ");

  const titulo = `<b>${escaparHtml(passo.titulo)}</b>`;
  const porque = escaparHtml(passo.porque);
  return dados ? `${titulo}. ${porque} (${escaparHtml(dados)})` : `${titulo}. ${porque}`;
}

/** Pistas de que a pergunta quer os TRÊS CENÁRIOS de poupança do mês, não o
 *  passo mais urgente — `gerarCenarios` (dentro de `gerarPlano`) já os
 *  calcula e já era testado, mas até aqui não havia forma de chegar a eles
 *  pelo chat: `responderPlano` só devolvia o primeiro passo. Verificado
 *  DEPOIS de `responderPlano` para não roubar as perguntas que já eram dele
 *  ("conselho", "sugestão"...), mas continua camada 1: zero rede, zero IA. */
const GATILHOS_CENARIOS = /\bcenarios?\b|quanto (devo |posso )?(guardar|poupar|separar)/;

/** Traduz os três cenários do plano em texto — mesma fronteira texto/números
 *  de `responderPlano`: só formata o que `gerarPlano` já calculou. */
export function responderCenarios(pergunta: string, ctx: ContextoCopiloto): string | null {
  const q = normalizarPergunta(pergunta);
  if (!GATILHOS_CENARIOS.test(q)) return null;

  const plano = gerarPlano(buildFinanceSnapshot(ctx));
  const moeda = ctx.cfg.currency;
  const partes = plano.cenarios
    .map((c) => `${c.titulo}: ${formatMoney(c.separar, moeda)}`)
    .join(", ");
  return `<b>Cenários para este mês</b>: ${escaparHtml(partes)}.`;
}
