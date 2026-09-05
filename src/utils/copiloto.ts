// Copiloto — motor de perguntas em linguagem natural (seção 3.9), portado do
// financas.html (_CP_INTENTS e vizinhos). Lista ordenada de intents (mais
// específico → mais genérico); o primeiro cujo test() bate vence.
//
// Esta é a CAMADA 1 do Copiloto e continua a ser 100% local, determinística e
// síncrona: toda a resposta sai de cálculo sobre o estado real da conta, sem
// rede nenhuma. Nada neste ficheiro chama IA.
//
// A camada 2 (services/copilotoIA.ts) só entra quando esta devolve
// `RESPOSTA_PADRAO`, ou seja, quando nenhum intent soube responder. Nunca por
// cima de uma resposta que a camada 1 conseguiu dar — o número calculado aqui
// vale sempre mais do que texto gerado.

import type {
  Cents,
  ConfigConta,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  EventoCalendario,
  Fundo,
  Parcela,
  Receita,
  Transferencia,
  YearMonth,
} from "../types";
import { doMes, mesDe, mesesRecentes, rotuloMes, somarMeses, totalDoMes } from "./calculos";
import { proximosEventos } from "./calendario";
import {
  calcularFatura,
  fixaAtivaNoMes,
  fixaEfetivamentePaga,
  montarDadosFatura,
  type DadosFatura,
} from "./fatura";
import { contribuicaoFixasMes } from "./despesasFixas";
import {
  contribuicaoParcelasMes,
  estaEfetivamentePaga,
  mesesDaParcela,
  mesesNaoPagos,
  valorDaParcela,
} from "./parcelas";
import { totalCargasMes, totalDespesasVeiculoMes, totalVeiculoMes } from "./veiculo";
import { formatMoney } from "./money";
import { nomeAtualDoMetodo } from "./instituicoes";
import { statusOrcamentoMes } from "./orcamento";

const ACENTOS: Record<string, string> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  ê: "e",
  è: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
};

/** Portado de _cpNorm. */
export function normalizarPergunta(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[áàâãäéêèëíìîïóòôõöúùûüç]/g, (m) => ACENTOS[m] ?? m);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Acha em `lista` a entrada cujo nome (ou uma palavra dele) aparece na
 *  pergunta, por PALAVRA INTEIRA — nunca substring solto (evita "AB" bater
 *  dentro de "abacate"). Nomes com anotação entre parênteses (ex. cartões
 *  "AB (D)") também casam pelo nome limpo, mesmo sendo curto — é assim que
 *  alguém escreveria. Portado de _cpFindInList. */
export function encontrarNaLista(pergunta: string, lista: string[], minLen = 4): string | null {
  let melhor: string | null = null;
  let melhorLen = 0;

  function tentarPalavraInteira(item: string, palavra: string) {
    if (!palavra) return;
    const re = new RegExp(`\\b${escaparRegex(palavra)}\\b`);
    if (re.test(pergunta) && palavra.length > melhorLen) {
      melhor = item;
      melhorLen = palavra.length;
    }
  }

  for (const item of lista) {
    if (!item) continue;
    const norm = normalizarPergunta(item);
    const flat = norm
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const palavras = flat.split(" ").filter((w) => w.length >= minLen);
    for (const w of palavras) tentarPalavraInteira(item, w);
    // Nome completo (mesmo curto, ex. "AB"): ainda testado por PALAVRA
    // INTEIRA via tryWholeWord — não por substring solto.
    //
    // BUG do app de referência a NÃO reproduzir: o _cpFindInList original
    // tinha, além disso, um fallback `q.indexOf(norm) > -1` sem \b nenhum —
    // pra nomes curtos sem parênteses (ex. cartão "AB") isso faz "AB" bater
    // dentro de QUALQUER palavra que contenha "ab" ("abacate", "trabalho",
    // "sábado"...), exatamente o falso positivo que casamento por palavra
    // inteira deveria evitar. Removido; tryWholeWord(item, flat) já cobre
    // nomes curtos corretamente, com fronteira de palavra real.
    if (flat) tentarPalavraInteira(item, flat);
  }
  return melhor;
}

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const MESES_COMPLETOS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function indiceDoMes(palavra: string): number {
  let i = MESES_ABREV.indexOf(palavra);
  if (i > -1) return i;
  i = MESES_COMPLETOS.indexOf(palavra);
  return i;
}

export interface ReferenciaTempo {
  ym: YearMonth;
  label: string;
  isYear?: boolean;
  year?: number;
}

/** Interpreta a que mês/ano a pergunta se refere. Sem pista nenhuma, usa o
 *  mês corrente. Portado de _cpParseRef.
 *
 *  `mesCorrente` é o mês em que a pergunta está ancorada — o que a pessoa tem
 *  no ecrã, não necessariamente o de hoje. `mesReal` é o de hoje e serve só
 *  para as duas coisas que dependem MESMO da data: o ano por omissão de um mês
 *  escrito sem ano e o travão que impede uma pergunta de cair num mês que
 *  ainda não aconteceu. Omitido, os dois coincidem — que é o caso de quem
 *  chama sem navegação por mês. */
export function interpretarReferencia(
  pergunta: string,
  mesCorrente: YearMonth,
  mesReal: YearMonth = mesCorrente,
): ReferenciaTempo {
  const q = normalizarPergunta(pergunta);
  if (q.includes("mes passado"))
    return { ym: somarMeses(mesCorrente, -1), label: rotuloMes(somarMeses(mesCorrente, -1)) };
  if (q.includes("este mes") || q.includes("mes atual"))
    return { ym: mesCorrente, label: rotuloMes(mesCorrente) };

  const anoAtual = parseInt(mesReal.slice(0, 4), 10);
  const anoPassado = q.includes("ano passado");
  const anoMatch = q.match(/\b(20\d{2})\b/);
  // "ano passado" também é um ano explícito: sem isto, "julho do ano passado"
  // caía no laço abaixo sem ano nenhum fixado e devolvia julho DESTE ano — a
  // parte "passado" da frase era lida e depois ignorada.
  const anoDaPergunta = anoMatch ? parseInt(anoMatch[1], 10) : anoPassado ? anoAtual - 1 : null;
  const palavras = q.split(/[^a-z0-9]+/);
  for (const w of palavras) {
    const mi = indiceDoMes(w);
    if (mi > -1) {
      const y = anoDaPergunta ?? anoAtual;
      let ym = `${y}-${String(mi + 1).padStart(2, "0")}`;
      // Mês no futuro é medido contra HOJE, não contra o mês que se está a
      // ver: com julho no ecrã, "agosto" continua a ser o agosto deste ano.
      if (!anoDaPergunta && ym > mesReal) ym = `${y - 1}-${String(mi + 1).padStart(2, "0")}`;
      return { ym, label: rotuloMes(ym) };
    }
  }

  // isYear: ainda assim carrega ym/label do mês corrente (fallback honesto
  // pros intents que não tratam isYear explicitamente)
  //
  // Bug corrigido: um ano explícito sem mês ("saldo de 2025", "resumo de
  // 2025") só ativava isYear se a pergunta também tivesse a palavra "ano" —
  // sem ela, caía direto no mês corrente e o ano escrito era lido e depois
  // ignorado, o mesmo problema que o comentário acima já descreve para "ano
  // passado" dentro do laço de meses. `anoDaPergunta` já cobre os dois casos
  // (ano escrito por extenso ou "ano passado"), por isso basta checá-lo aqui.
  if (anoDaPergunta !== null)
    return { ym: mesCorrente, label: rotuloMes(mesCorrente), isYear: true, year: anoDaPergunta };
  if (/\bano\b/.test(q))
    return { ym: mesCorrente, label: rotuloMes(mesCorrente), isYear: true, year: anoAtual };

  return { ym: mesCorrente, label: rotuloMes(mesCorrente) };
}

export interface ContextoCopiloto {
  /** Já sem ajustes de reconciliação (origem 'recon') — ver receitasNosTotais. */
  receitas: Receita[];
  /** Já sem pagamentos de fatura (origem 'fat') — ver despesasNosTotais. */
  despesas: DespesaCorrente[];
  parcelas: Parcela[];
  cfg: ConfigConta;
  veiculo: DadosVeiculo;
  /** Despesas fixas gerais — entram no total do mês (mesma regra do resto do
   *  app) e no cálculo de fatura. Obrigatórias: sem elas o Copiloto devolve
   *  um número menor que o KPI "Despesas" da mesma tela. */
  despesasFixas: DespesaFixa[];
  /** Só usadas no cálculo de fatura (intent "pendentes"). */
  transferencias?: Transferencia[];
  eventos: EventoCalendario[];
  /** Fundos/sub-metas ("cofrinhos"). Independentes de `cfg.metaPoupanca`, que
   *  é um valor agregado único e legado: a meta de poupança responde "quanto
   *  devia sobrar por mês", os fundos respondem "quanto falta para a viagem".
   *  São perguntas diferentes e ambas continuam a existir. */
  fundos: Fundo[];
  /** Mês real de hoje — usado pra decidir se "projeção no ritmo atual" faz
   *  sentido (só quando a pergunta é sobre o mês corrente de verdade) e se uma
   *  fixa/parcela do mês já venceu. NÃO é o mês de que as respostas falam:
   *  para isso existe `mesVisivel`. */
  mesReal: YearMonth;
  /** Mês que a pessoa está a ver no seletor do header — é DELE que as
   *  perguntas de período falam quando não nomeiam mês nenhum ("resumo do
   *  mês", "qual meu saldo?"), e é ele que ancora as referências relativas
   *  ("mês passado"). Com o Início em julho, o Copiloto respondia sobre agosto
   *  porque só conhecia `mesReal`. Ausente = cai no mês real, que é o
   *  comportamento certo para quem não navega por mês. */
  mesVisivel?: YearMonth;
  diaDeHoje: number;
  /** Qual das variações de fraseado usar. Ausente/0 = a frase histórica.
   *  Quem chama roda o número para as respostas não saírem sempre iguais. */
  variante?: number;
}

/** 'YYYY-MM-DD' de hoje, reconstruído de mesReal+diaDeHoje (mesma fonte que
 *  o resto do contexto, sem introduzir um terceiro "agora" independente). */
function hojeDoContexto(ctx: ContextoCopiloto): string {
  return `${ctx.mesReal}-${String(ctx.diaDeHoje).padStart(2, "0")}`;
}

/** Despesas do mês somando fixas, parcelas e veículo (Parte A) — as MESMAS
 *  quatro parcelas de despesaRealizadaMes (utils/resumoMensal.ts), pra o
 *  Copiloto não responder um número menor que o KPI "Despesas" logo acima
 *  dele no Início. Fixas e parcelas contam pelo plano, com a regra mês
 *  corrente/mês fechado. */
/** Meses inteiros de `de` até `ate` (negativo se `ate` já passou). */
export function diferencaEmMeses(de: YearMonth, ate: YearMonth): number {
  const [dy, dm] = de.split("-").map(Number);
  const [ay, am] = ate.split("-").map(Number);
  return (ay - dy) * 12 + (am - dm);
}

export interface ProgressoFundo {
  fundo: Fundo;
  falta: Cents;
  /** 0–100, limitado a 100 mesmo quando se guardou a mais que o alvo. */
  pct: number;
  concluido: boolean;
  /** Meses que restam até ao prazo CONTANDO o mês corrente — é neste mês que
   *  ainda dá para separar dinheiro, portanto ele conta. `null` sem prazo. */
  mesesRestantes: number | null;
  /** Quanto separar por mês para lá chegar. Arredondado para CIMA: arredondar
   *  para baixo faz a soma das parcelas ficar debaixo do alvo, que é
   *  exactamente o que a pessoa não quer descobrir no último mês. */
  porMes: Cents | null;
  /** Tem prazo, o prazo já passou e o fundo não está completo. */
  prazoVencido: boolean;
}

/** Estado de um fundo: quanto falta, e — havendo prazo — quanto separar por
 *  mês para lá chegar a tempo. Pura, para servir tanto o intent como o
 *  snapshot sem duplicar a aritmética. */
export function progressoFundo(fundo: Fundo, mesReal: YearMonth): ProgressoFundo {
  const falta = Math.max(0, fundo.alvo - fundo.atual);
  const concluido = falta === 0;
  const pct = fundo.alvo > 0 ? Math.min(100, Math.round((fundo.atual / fundo.alvo) * 100)) : 0;

  if (!fundo.prazo) {
    return {
      fundo,
      falta,
      pct,
      concluido,
      mesesRestantes: null,
      porMes: null,
      prazoVencido: false,
    };
  }

  const mesesRestantes = diferencaEmMeses(mesReal, mesDe(fundo.prazo)) + 1;
  const prazoVencido = !concluido && mesesRestantes <= 0;
  return {
    fundo,
    falta,
    pct,
    concluido,
    mesesRestantes,
    porMes: concluido || mesesRestantes <= 0 ? null : Math.ceil(falta / mesesRestantes),
    prazoVencido,
  };
}

export function totaisDoMes(ctx: ContextoCopiloto, ym: YearMonth) {
  // `hoje` dá precisão de DIA ao mês corrente: sem ele, uma fixa ou parcela em
  // débito automático que só vence no dia 27 já contava como despesa realizada
  // no dia 8. Ver a nota em `despesaRealizadaMes` (utils/resumoMensal.ts), que
  // é a soma equivalente do Início.
  const hoje = hojeDoContexto(ctx);
  const despesas =
    totalDoMes(ctx.despesas, ym) +
    contribuicaoFixasMes(ctx.despesasFixas, ym, ctx.mesReal, hoje) +
    contribuicaoParcelasMes(ctx.parcelas, ym, ctx.mesReal, hoje) +
    totalVeiculoMes(ctx.veiculo, ym, ctx.mesReal, hoje);
  return { receitas: totalDoMes(ctx.receitas, ym), despesas };
}

/** Quantos dias tem o mês. `new Date(ano, mes, 0)` — com o mês 1-12 tal como
 *  vem do 'YYYY-MM' — cai no último dia desse mês, sem tabela de 30/31. */
export function ultimoDiaDoMes(ym: YearMonth): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Saldo projetado para o fim do mês, mantendo o ritmo do que já correu.
 *
 *  `null` quando a projeção não quer dizer nada: num mês fechado o saldo já é
 *  o final (projetar seria inventar), e sem um dia de hoje válido a divisão
 *  não existe. */
export function projecaoFimMes(ctx: ContextoCopiloto, ym: YearMonth): Cents | null {
  if (ym !== ctx.mesReal || ctx.diaDeHoje <= 0) return null;
  const t = totaisDoMes(ctx, ym);
  return Math.round(((t.receitas - t.despesas) / ctx.diaDeHoje) * ultimoDiaDoMes(ym));
}

/** Breakdown por categoria do mês, com o veículo entrando num bucket
 *  'Veículo' único (mesmo padrão do _cpCatTotals da origem). */
export function categoriasDoMes(ctx: ContextoCopiloto, ym: YearMonth): Record<string, Cents> {
  // Mesma regra de dia que `totaisDoMes` — e tem de ser mesmo a mesma, senão a
  // soma das categorias deixa de bater com o total do próprio Copiloto.
  const hoje = hojeDoContexto(ctx);
  const ct: Record<string, Cents> = {};
  for (const d of doMes(ctx.despesas, ym)) ct[d.categoria] = (ct[d.categoria] || 0) + d.valor;
  for (const f of ctx.despesasFixas.filter((f) => fixaAtivaNoMes(f, ym))) {
    if (ym === ctx.mesReal && !fixaEfetivamentePaga(f, ym, ctx.mesReal, hoje)) continue;
    ct[f.categoria] = (ct[f.categoria] || 0) + f.valor;
  }
  for (const p of ctx.parcelas.filter((p) => mesesDaParcela(p).includes(ym))) {
    if (ym === ctx.mesReal && !estaEfetivamentePaga(p, ym, ctx.mesReal, hoje)) continue;
    const cat = p.categoria ?? "Parcelas";
    ct[cat] = (ct[cat] || 0) + valorDaParcela(p, ym);
  }
  const totalVeic = totalVeiculoMes(ctx.veiculo, ym, ctx.mesReal, hoje);
  if (totalVeic > 0) ct["Veículo"] = (ct["Veículo"] || 0) + totalVeic;
  return ct;
}

/** Quantos meses fechados entram na média por categoria. 3 é pouco para
 *  absorver um mês atípico; mais do que 6 traz hábitos que já não são os de
 *  agora. Usa-se o que houver dentro desta janela. */
const MESES_DE_MEDIA = 6;
const MESES_DE_MEDIA_MINIMO = 3;

export interface MediaCategoria {
  categoria: string;
  gastoAtual: Cents;
  media: Cents;
  /** Quantos meses fechados a média usou — sem isto não se sabe se ela é
   *  confiável ou se é um mês só a fingir de tendência. */
  mesesUsados: number;
  /** Positivo = está a gastar acima do costume. */
  desvio: Cents;
  desvioPct: number | null;
}

/** Compara o mês com a média dos meses fechados anteriores, por categoria.
 *
 *  É a única parte do Copiloto que olha para mais do que um mês. Sem ela só
 *  se consegue afirmar "gastaste X"; com ela dá para dizer "isto está acima
 *  do teu costume", que é a pergunta que as pessoas fazem de verdade. */
export function mediasPorCategoria(ctx: ContextoCopiloto, ym: YearMonth): MediaCategoria[] {
  // +1 e slice: mesesRecentes inclui o mês de referência, que é justamente o
  // que não pode entrar na própria média.
  const anteriores = mesesRecentes(MESES_DE_MEDIA + 1, ym).slice(0, -1);
  const porMes = anteriores.map((m) => categoriasDoMes(ctx, m));
  const atual = categoriasDoMes(ctx, ym);

  const categorias = new Set<string>([
    ...Object.keys(atual),
    ...porMes.flatMap((cats) => Object.keys(cats)),
  ]);

  const linhas: MediaCategoria[] = [];
  for (const categoria of categorias) {
    // Só meses em que a categoria teve movimento — incluir zeros de meses em
    // que ela nem existia puxava a média para baixo e fazia tudo parecer
    // "acima do costume".
    const valores = porMes.map((c) => c[categoria]).filter((v): v is Cents => v !== undefined);
    if (valores.length < MESES_DE_MEDIA_MINIMO) continue;

    const media = Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
    const gastoAtual = atual[categoria] ?? 0;
    linhas.push({
      categoria,
      gastoAtual,
      media,
      mesesUsados: valores.length,
      desvio: gastoAtual - media,
      desvioPct: media > 0 ? Math.round(((gastoAtual - media) / media) * 100) : null,
    });
  }

  return linhas.sort((a, b) => b.desvio - a.desvio);
}

/** Categorias claramente acima do costume — o "o que está pesando".
 *  O corte de 15% existe para não chamar tendência a ruído de arredondamento. */
export function categoriasAcimaDaMedia(
  ctx: ContextoCopiloto,
  ym: YearMonth,
  minPct = 15,
): MediaCategoria[] {
  return mediasPorCategoria(ctx, ym).filter(
    (m) => m.desvio > 0 && m.desvioPct !== null && m.desvioPct >= minPct,
  );
}

function melhorPiorMes(ctx: ContextoCopiloto, ano: number) {
  let melhor: { ym: YearMonth; saldo: Cents } | null = null;
  let pior: { ym: YearMonth; saldo: Cents } | null = null;
  for (let mi = 1; mi <= 12; mi++) {
    const ym = `${ano}-${String(mi).padStart(2, "0")}`;
    if (ym > ctx.mesReal) break;
    const t = totaisDoMes(ctx, ym);
    const saldo = t.receitas - t.despesas;
    if (!melhor || saldo > melhor.saldo) melhor = { ym, saldo };
    if (!pior || saldo < pior.saldo) pior = { ym, saldo };
  }
  return { melhor, pior };
}

export function dadosFaturaDoContexto(ctx: ContextoCopiloto): DadosFatura {
  return montarDadosFatura({
    despesas: ctx.despesas,
    despesasFixas: ctx.despesasFixas,
    transferencias: ctx.transferencias ?? [],
    parcelas: ctx.parcelas,
    veiculo: ctx.veiculo,
    receitas: ctx.receitas,
  });
}

/** '2026-07-05' → '05/07'. Dia e mês bastam onde o ano é o do contexto. */
export function dataCurta(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/** Quanto um cartão/conta específico movimentou no mês: despesas correntes +
 *  fixas (gerais e do veículo) + parcelas + cargas/despesas do veículo, tudo
 *  o que tiver esse `contaCartao`/`cartao`. Mesma regra de "efetivamente
 *  paga" que `categoriasDoMes` usa — sem ela, este intent tinha o mesmo furo
 *  que a categoria já teve: uma fixa ou parcela em débito automático no
 *  cartão não contava sem alguém marcar "pago" à mão. */
/** Os nomes de HOJE das contas/cartões, na mesma ordem de `contasCartoes` —
 *  que guarda os ids. É por índice que se volta de um para o outro. */
const nomesDosCartoes = (ctx: ContextoCopiloto): string[] =>
  ctx.cfg.contasCartoes.map((c) => nomeAtualDoMetodo(ctx.cfg, c));

function totalCartaoMes(ctx: ContextoCopiloto, cartao: string, ym: YearMonth): Cents {
  const hoje = hojeDoContexto(ctx);
  let total = ctx.despesas
    .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ym)
    .reduce((s, d) => s + d.valor, 0);

  for (const f of [...ctx.despesasFixas, ...ctx.veiculo.despesasFixas]) {
    if (f.contaCartao !== cartao || !fixaAtivaNoMes(f, ym)) continue;
    if (ym === ctx.mesReal && !fixaEfetivamentePaga(f, ym, ctx.mesReal, hoje)) continue;
    total += f.valor;
  }

  for (const p of ctx.parcelas) {
    if (p.cartao !== cartao || !mesesDaParcela(p).includes(ym)) continue;
    if (ym === ctx.mesReal && !estaEfetivamentePaga(p, ym, ctx.mesReal, hoje)) continue;
    total += valorDaParcela(p, ym);
  }

  total += ctx.veiculo.cargas
    .filter((c) => c.contaCartao === cartao && mesDe(c.data) === ym)
    .reduce((s, c) => s + c.custo, 0);
  total += ctx.veiculo.despesas
    .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ym)
    .reduce((s, d) => s + d.valor, 0);

  return total;
}

interface IntentCopiloto {
  test: (q: string, ctx: ContextoCopiloto) => boolean;
  run: (q: string, ref: ReferenciaTempo, ctx: ContextoCopiloto) => string | null;
}

/** Escapa metacaracteres HTML — a resposta é renderizada com
 *  dangerouslySetInnerHTML (só pra permitir o <b> de destaque), e vários
 *  valores interpolados (nome de categoria/cartão/fonte/parcela) vêm de
 *  texto livre configurado pelo usuário: sem isso, um nome de categoria tipo
 *  '<img onerror=...>' viraria XSS armazenado. impeccable-disable-line broken-image */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const b = (s: string) => `<b>${escaparHtml(s)}</b>`;

/** Primeira palavra do nome configurado, já escapada — vai para dentro de
 *  `dangerouslySetInnerHTML` como todo o resto, e este é texto livre que a
 *  própria pessoa escreveu. */
function vocativo(ctx: ContextoCopiloto): string {
  const nome = ctx.cfg.copiloto?.nome?.trim();
  if (!nome) return "";
  return `${escaparHtml(nome.split(/\s+/)[0])}, `;
}

/** Frases alternativas por tom. O primeiro item de `direto` é sempre o
 *  fraseado histórico do intent — sem personalização e sem rodar variante, a
 *  resposta sai exactamente como saía antes. */
export interface FrasesPorTom {
  direto: string[];
  acolhedor: string[];
}

/** Escolhe a variação e prende-lhe o vocativo.
 *
 *  A variação vem do contexto (`variante`) e nunca de `Math.random()`: com
 *  aleatoriedade real, o mesmo estado dava respostas diferentes entre
 *  execuções e nenhum teste conseguiria fixar uma. Quem chama é que roda o
 *  número — a tela incrementa-o a cada pergunta.
 *
 *  Os corpos das frases começam em minúscula porque podem vir atrás de um
 *  nome ("Gabriel, em julho…"); sem nome, capitaliza-se aqui.
 *
 *  Bug corrigido: `frases[tom]` assumia que `cfg.copiloto.tom`, vindo direto
 *  do RTDB sem validação de campo (ver `normalizarConfig`), era sempre
 *  "direto" ou "acolhedor". Um valor gravado à mão ou por uma versão antiga
 *  do campo tornava `frases[tom]` `undefined`, e o `.length` a seguir
 *  rebentava — a mesma classe de dado corrompido que `iaUsoService.ts` já
 *  trata com `typeof atual === "number" ? atual : 0`. */
function variar(ctx: ContextoCopiloto, frases: FrasesPorTom): string {
  const tom = ctx.cfg.copiloto?.tom ?? "direto";
  const lista = frases[tom]?.length ? frases[tom] : frases.direto;
  const corpo = lista[(ctx.variante ?? 0) % lista.length];
  const v = vocativo(ctx);
  return v ? v + corpo : corpo.charAt(0).toUpperCase() + corpo.slice(1);
}

/** Frases que revelam que a pergunta é sobre juntar dinheiro para algo, e não
 *  sobre o que já se gastou nisso. É o que desempata um fundo e uma categoria
 *  com o mesmo nome. */
const PALAVRAS_DE_META =
  /fundo|meta|falta|chegar|juntar|poupar|guardar|atingir|objetivo|objectivo|cofrinho/;

export const INTENTS_COPILOTO: IntentCopiloto[] = [
  // parcela específica (por nome)
  {
    test: (q, ctx) =>
      !!encontrarNaLista(
        q,
        ctx.parcelas.map((p) => p.descricao),
      ),
    run: (q, _ref, ctx) => {
      const nome = encontrarNaLista(
        q,
        ctx.parcelas.map((p) => p.descricao),
      );
      const p = ctx.parcelas.find((x) => x.descricao === nome);
      if (!p) return null;
      const abertos = mesesNaoPagos(p, ctx.mesReal);
      if (!abertos.length)
        return variar(ctx, {
          direto: [`a parcela ${b(p.descricao)} já está totalmente paga.`],
          acolhedor: [`boa notícia: a parcela ${b(p.descricao)} já está toda paga.`],
        });
      const restante = abertos.reduce((s, m) => s + valorDaParcela(p, m), 0);
      const n = b(String(abertos.length));
      const total = b(formatMoney(restante, ctx.cfg.currency));
      const proxima = b(rotuloMes(abertos[0]));
      return variar(ctx, {
        direto: [
          `faltam ${n} parcela(s) de ${b(p.descricao)}, no total de ${total}. Próxima em ${proxima}.`,
          `${b(p.descricao)} ainda tem ${n} parcela(s) por pagar, ${total} ao todo — a próxima em ${proxima}.`,
        ],
        acolhedor: [
          `ainda faltam ${n} parcela(s) de ${b(p.descricao)}, ${total} no total, com a próxima em ${proxima}.`,
          `de ${b(p.descricao)} restam ${n} parcela(s), ${total} ao todo — a próxima vence em ${proxima}.`,
        ],
      });
    },
  },
  // parcelas agregado
  {
    test: (q) => /parcela|prestac/.test(q),
    run: (_q, _ref, ctx) => {
      let total = 0;
      let n = 0;
      for (const p of ctx.parcelas) {
        for (const m of mesesNaoPagos(p, ctx.mesReal)) {
          total += valorDaParcela(p, m);
          n++;
        }
      }
      if (!n)
        return variar(ctx, {
          direto: ["não há parcelas em aberto.", "nenhuma parcela por pagar de momento."],
          acolhedor: ["não há parcelas em aberto — está tudo pago por aqui."],
        });
      const dinheiro = b(formatMoney(total, ctx.cfg.currency));
      const qtd = b(String(n));
      return variar(ctx, {
        direto: [
          `tem ${qtd} parcela(s) por pagar, no total de ${dinheiro}.`,
          `${qtd} parcela(s) em aberto, somando ${dinheiro}.`,
        ],
        acolhedor: [
          `ainda tem ${qtd} parcela(s) por pagar, ${dinheiro} ao todo.`,
          `restam ${qtd} parcela(s) em aberto, num total de ${dinheiro}.`,
        ],
      });
    },
  },
  // cartão específico
  //
  // Bug corrigido: normalizarPergunta troca "õ" por "o" mas não "ão" por "ao"
  // — "cartões" (plural) normaliza para "cartoes", que não contém "cartao".
  // Só testar o singular fazia "quanto gastei nos cartões AB este mês?" não
  // bater aqui e cair, sem avisar, no intent agregado (cartão mais usado),
  // que responde outra pergunta.
  {
    // A pergunta traz o nome de HOJE do cartão; o que os lançamentos guardam é
    // o id, que pode ser o nome antigo. Procura-se pelos nomes e volta-se ao
    // id pelo índice — as duas listas andam a par.
    test: (q, ctx) => /cartao|cartoes/.test(q) && !!encontrarNaLista(q, nomesDosCartoes(ctx), 5),
    run: (q, ref, ctx) => {
      const nomes = nomesDosCartoes(ctx);
      const nome = encontrarNaLista(q, nomes, 5)!;
      const cartao = ctx.cfg.contasCartoes[nomes.indexOf(nome)];
      const total = totalCartaoMes(ctx, cartao, ref.ym);
      const dinheiro = b(formatMoney(total, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `gastou ${dinheiro} no cartão ${b(nome)} em ${ref.label}.`,
          `o cartão ${b(nome)} teve ${dinheiro} de despesas em ${ref.label}.`,
        ],
        acolhedor: [
          `em ${ref.label}, o cartão ${b(nome)} teve ${dinheiro} de despesas.`,
          `no cartão ${b(nome)} saíram ${dinheiro} em ${ref.label}.`,
        ],
      });
    },
  },
  // cartões agregado / mais usado
  {
    test: (q) => /cartao|cartoes|cartões/.test(q),
    run: (_q, ref, ctx) => {
      const cartoes = ctx.cfg.contasCartoes;
      if (!cartoes.length) return "Ainda não há cartões configurados.";
      const linhas = cartoes
        .map((cartao) => ({
          nome: nomeAtualDoMetodo(ctx.cfg, cartao),
          total: totalCartaoMes(ctx, cartao, ref.ym),
        }))
        .sort((a, b2) => b2.total - a.total);
      if (!linhas[0].total)
        return variar(ctx, {
          direto: [`não há despesas em nenhum cartão em ${ref.label}.`],
          acolhedor: [`não há despesas em nenhum cartão em ${ref.label} — nada a assinalar.`],
        });
      const dinheiro = b(formatMoney(linhas[0].total, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `o cartão mais usado em ${ref.label} foi ${b(linhas[0].nome)}, com ${dinheiro} em despesas.`,
          `em ${ref.label}, quem mais gastou foi o cartão ${b(linhas[0].nome)}, com ${dinheiro}.`,
        ],
        acolhedor: [
          `o cartão que mais usou em ${ref.label} foi ${b(linhas[0].nome)}, com ${dinheiro} em despesas.`,
        ],
      });
    },
  },
  // receita por fonte específica
  {
    test: (q, ctx) => !!encontrarNaLista(q, ctx.cfg.fontesReceita, 5),
    run: (q, ref, ctx) => {
      const fonte = encontrarNaLista(q, ctx.cfg.fontesReceita, 5)!;
      const total = ctx.receitas
        .filter((r) => mesDe(r.data) === ref.ym && r.fonte === fonte)
        .reduce((s, r) => s + r.valor, 0);
      if (total <= 0)
        return variar(ctx, {
          direto: [`não há receitas de ${b(fonte)} registadas em ${ref.label}.`],
          acolhedor: [`ainda não há receitas de ${b(fonte)} registadas em ${ref.label}.`],
        });
      const dinheiro = b(formatMoney(total, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `recebeu ${dinheiro} de ${b(fonte)} em ${ref.label}.`,
          `${b(fonte)} rendeu ${dinheiro} em ${ref.label}.`,
        ],
        acolhedor: [
          `em ${ref.label} entraram ${dinheiro} de ${b(fonte)}.`,
          `recebeu ${dinheiro} de ${b(fonte)} durante ${ref.label}.`,
        ],
      });
    },
  },
  // fundo/sub-meta específico pelo nome ("falta muito para a viagem?")
  //
  // Vem ANTES da categoria de despesa porque um fundo e uma categoria podem
  // chamar-se igual ("Viagem"): quem escreve "quanto falta para a viagem"
  // quer o cofrinho, não o quanto já gastou. Sem linguagem de meta na frase,
  // porém, a categoria ganha — aí "gastei na viagem" continua a ser gasto.
  {
    test: (q, ctx) => {
      const nome = encontrarNaLista(
        q,
        ctx.fundos.map((f) => f.nome),
      );
      if (!nome) return false;
      if (PALAVRAS_DE_META.test(q)) return true;
      return !encontrarNaLista(q, ctx.cfg.categoriasDespesa);
    },
    run: (q, _ref, ctx) => {
      const nome = encontrarNaLista(
        q,
        ctx.fundos.map((f) => f.nome),
      );
      const fundo = ctx.fundos.find((f) => f.nome === nome);
      if (!fundo) return null;

      const p = progressoFundo(fundo, ctx.mesReal);
      const moeda = ctx.cfg.currency;
      const base = `o fundo ${b(fundo.nome)} está em ${b(formatMoney(fundo.atual, moeda))} de ${b(formatMoney(fundo.alvo, moeda))} (${p.pct}%).`;

      if (p.concluido)
        return variar(ctx, {
          direto: [`${base} Já chegou ao alvo.`, `${base} Alvo atingido.`],
          acolhedor: [`${base} Parabéns, já chegou ao alvo!`],
        });

      const falta = b(formatMoney(p.falta, moeda));
      if (p.prazoVencido) {
        const prazo = b(rotuloMes(mesDe(fundo.prazo!)));
        return variar(ctx, {
          direto: [`${base} Faltam ${falta} e o prazo (${prazo}) já passou.`],
          acolhedor: [`${base} Ainda faltam ${falta}, mas o prazo (${prazo}) já passou.`],
        });
      }
      if (p.porMes === null || p.mesesRestantes === null)
        return variar(ctx, {
          direto: [
            `${base} Faltam ${falta}. Sem prazo definido, não dá para dizer quanto por mês.`,
          ],
          acolhedor: [
            `${base} Faltam ${falta}. Sem prazo definido, não há como calcular quanto por mês.`,
          ],
        });

      const prazo = b(rotuloMes(mesDe(fundo.prazo!)));
      const meses = b(String(p.mesesRestantes));
      const porMes = b(formatMoney(p.porMes, moeda));
      return variar(ctx, {
        direto: [
          `${base} Faltam ${falta}. Até ${prazo} são ${meses} mês(es) — dá cerca de ${porMes} por mês.`,
          `${base} Faltam ${falta}, com ${meses} mês(es) até ${prazo}: cerca de ${porMes} por mês.`,
        ],
        acolhedor: [
          `${base} Faltam ${falta}. Separando cerca de ${porMes} por mês, dá para chegar a ${prazo}.`,
        ],
      });
    },
  },
  // categoria de despesa específica
  //
  // Bug corrigido: `!val` só apanha exactamente zero. Um reembolso é uma
  // despesa de valor NEGATIVO na mesma categoria (ver utils/reembolsos.ts) —
  // se ele cobrir ou ultrapassar as despesas do mês nessa categoria, `val`
  // fica negativo, e a resposta dizia "gastou -€ 30,00 em Saúde", uma frase
  // sem sentido (não se "gasta" um valor negativo). `despesaPorCategoria.ts`
  // já trata o mesmo caso (`.filter(([, valor]) => valor > 0)`, com a mesma
  // explicação); aqui faltava o espelho dessa regra.
  {
    test: (q, ctx) => !!encontrarNaLista(q, ctx.cfg.categoriasDespesa),
    run: (q, ref, ctx) => {
      const cat = encontrarNaLista(q, ctx.cfg.categoriasDespesa)!;
      const ct = categoriasDoMes(ctx, ref.ym);
      const val = ct[cat] || 0;
      if (val <= 0)
        return variar(ctx, {
          direto: [`não há gastos em ${b(cat)} em ${ref.label}.`],
          acolhedor: [`não gastou nada em ${b(cat)} em ${ref.label} — nada a assinalar aqui.`],
        });
      const totalDesp = Object.values(ct).reduce((s, v) => s + v, 0);
      const pct = totalDesp > 0 ? Math.round((val / totalDesp) * 100) : 0;
      const dinheiro = b(formatMoney(val, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `gastou ${dinheiro} em ${b(cat)} em ${ref.label} — ${pct}% do total de despesas do mês.`,
          `${b(cat)} levou ${dinheiro} em ${ref.label}, ${pct}% de tudo o que saiu no mês.`,
          `em ${ref.label}, ${b(cat)} ficou em ${dinheiro} (${pct}% das despesas).`,
        ],
        acolhedor: [
          `em ${ref.label} foram ${dinheiro} em ${b(cat)}, o que dá ${pct}% das suas despesas do mês.`,
          `${b(cat)} ficou em ${dinheiro} em ${ref.label} — cerca de ${pct}% do que gastou no mês.`,
          `gastou ${dinheiro} em ${b(cat)} durante ${ref.label}, ou seja ${pct}% do total do mês.`,
        ],
      });
    },
  },
  // combustível / carregamento elétrico
  //
  // Vêm DEPOIS dos intents por nome (parcela/cartão/fonte/fundo/categoria)
  // porque as suas palavras-chave são genéricas demais para vir antes: uma
  // parcela de financiamento chamada "Carro", ou um fundo/cartão/categoria
  // com "combustível"/"gasolina" no nome, ficavam sequestrados por estes
  // testes antes sequer de chegar ao teste por nome, mesmo estando esses mais
  // abaixo na lista — a ordem "mais específico → mais genérico" do topo do
  // ficheiro valia para a maioria dos intents, menos para estes três.
  {
    test: (q) => /combust|gasolina|carregament|abasteci|encher o deposito/.test(q),
    run: (q, ref, ctx) => {
      if (q.includes("ultimo") || q.includes("ultima")) {
        const ordenadas = [...ctx.veiculo.cargas].sort((a, b2) => (a.data < b2.data ? 1 : -1));
        if (!ordenadas.length)
          return variar(ctx, {
            direto: ["ainda não há registos de combustível/carregamento."],
            acolhedor: ["ainda não há nenhum registo de combustível/carregamento por aqui."],
          });
        const c = ordenadas[0];
        const local = c.local ? ` em ${b(c.local)}` : "";
        const dinheiro = b(formatMoney(c.custo, ctx.cfg.currency));
        return variar(ctx, {
          direto: [
            `o último carregamento foi em ${b(dataCurta(c.data))}${local}, no valor de ${dinheiro}.`,
          ],
          acolhedor: [
            `o último carregamento foi em ${b(dataCurta(c.data))}${local}, e custou ${dinheiro}.`,
          ],
        });
      }
      const total = totalCargasMes(ctx.veiculo, ref.ym);
      if (total <= 0)
        return variar(ctx, {
          direto: [`não há gastos de combustível/carregamento registados em ${ref.label}.`],
          acolhedor: [`não há gastos de combustível/carregamento em ${ref.label} — nada por aqui.`],
        });
      const dinheiro = b(formatMoney(total, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `gastou ${dinheiro} em combustível/carregamento em ${ref.label}.`,
          `combustível/carregamento levou ${dinheiro} em ${ref.label}.`,
        ],
        acolhedor: [`em ${ref.label} foram ${dinheiro} em combustível/carregamento.`],
      });
    },
  },
  // manutenção / limpeza do veículo
  {
    test: (q) => /manutenc|limpeza|lavagem|revisao/.test(q),
    run: (_q, ref, ctx) => {
      const total = totalDespesasVeiculoMes(ctx.veiculo, ref.ym);
      if (total <= 0)
        return variar(ctx, {
          direto: [`não há gastos de manutenção/limpeza registados em ${ref.label}.`],
          acolhedor: [`não há gastos de manutenção/limpeza em ${ref.label} — nada por aqui.`],
        });
      const dinheiro = b(formatMoney(total, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `gastou ${dinheiro} em manutenção/limpeza do veículo em ${ref.label}.`,
          `manutenção/limpeza do veículo levou ${dinheiro} em ${ref.label}.`,
        ],
        acolhedor: [`em ${ref.label} foram ${dinheiro} em manutenção/limpeza do veículo.`],
      });
    },
  },
  // veículo genérico (soma tudo: cargas + despesas + fixas)
  //
  // Chama `totalVeiculoMes` directamente, sem passar por `totaisDoMes` nem
  // `categoriasDoMes` — foi por isso que escapou à correção de 617d305 e
  // continuou a contar o seguro do dia 28 já no dia 3.
  {
    test: (q) => /veiculo|viatura|\bcarro\b/.test(q),
    run: (_q, ref, ctx) => {
      const dinheiro = b(
        formatMoney(
          totalVeiculoMes(ctx.veiculo, ref.ym, ctx.mesReal, hojeDoContexto(ctx)),
          ctx.cfg.currency,
        ),
      );
      return variar(ctx, {
        direto: [
          `o total gasto com o veículo em ${ref.label} foi ${dinheiro} (combustível, manutenção e despesas fixas).`,
          `em ${ref.label}, o veículo custou ${dinheiro} ao todo (combustível, manutenção e despesas fixas).`,
        ],
        acolhedor: [
          `o veículo custou ${dinheiro} em ${ref.label}, somando combustível, manutenção e fixas.`,
        ],
      });
    },
  },
  // orçamento (categorias com teto configurado — seção 4.8)
  {
    test: (q) => /orcament|dentro do/.test(q),
    run: (_q, ref, ctx) => {
      const categorias = Object.keys(ctx.cfg.orcamentos).filter((c) => ctx.cfg.orcamentos[c] > 0);
      if (!categorias.length) return "Ainda não há orçamento definido por categoria.";
      // statusOrcamentoMes, não categoriasDoMes: o teto por categoria só conta
      // despesas correntes + parcelas (mesma regra da tela Planejamento →
      // Orçamento). categoriasDoMes também soma fixas e veículo, o que fazia o
      // Copiloto dizer "estourou" numa categoria que a própria tela do
      // orçamento mostrava dentro do teto.
      const status = statusOrcamentoMes(
        ctx.despesas,
        ctx.parcelas,
        ctx.cfg.orcamentos,
        ref.ym,
        ctx.mesReal,
        hojeDoContexto(ctx),
      );
      const estourou = status.filter((s) => s.estourado).map((s) => s.categoria);
      if (!estourou.length)
        return variar(ctx, {
          direto: [
            `está dentro do orçamento em todas as categorias em ${ref.label}.`,
            `nenhuma categoria passou do teto em ${ref.label}.`,
            `orçamento de ${ref.label} cumprido em todas as categorias.`,
          ],
          acolhedor: [
            `está tudo dentro do orçamento em ${ref.label} — nenhuma categoria passou do teto.`,
            `boas notícias: em ${ref.label} nenhuma categoria estourou o que tinha planeado.`,
            `em ${ref.label} conseguiu ficar dentro do teto em todas as categorias.`,
          ],
        });
      const lista = b(estourou.join(", "));
      return variar(ctx, {
        direto: [
          `está a ultrapassar o orçamento em ${ref.label} em: ${lista}.`,
          `passou do teto em ${ref.label} em: ${lista}.`,
          `fora do orçamento em ${ref.label}: ${lista}.`,
        ],
        acolhedor: [
          `em ${ref.label} há categorias acima do teto: ${lista}. Vale a pena olhar para elas.`,
          `atenção a ${lista} — passaram do orçamento que tinha definido para ${ref.label}.`,
          `em ${ref.label}, ${lista} ficaram acima do planeado.`,
        ],
      });
    },
  },
  // pendências: parcelas do mês em aberto + faturas de cartão com restante
  {
    test: (q) => /pendente|em aberto|por pagar|por lancar/.test(q),
    run: (_q, ref, ctx) => {
      const parcelasPendentes = ctx.parcelas.filter((p) =>
        mesesNaoPagos(p, ctx.mesReal).includes(ref.ym),
      );
      const cartoesCredito = ctx.cfg.contasCartoes.filter(
        (c) => ctx.cfg.tipoCartao[c] === "credit",
      );
      const dados = dadosFaturaDoContexto(ctx);
      const faturasComRestante = cartoesCredito
        .map((c) => calcularFatura(c, ref.ym, dados, ctx.cfg))
        .filter((f) => f.restante > 0);
      if (!parcelasPendentes.length && !faturasComRestante.length)
        return variar(ctx, {
          direto: [`não há pendentes em ${ref.label}.`],
          acolhedor: [`não há nada pendente em ${ref.label} — está tudo em dia.`],
        });
      const partes: string[] = [];
      if (parcelasPendentes.length) partes.push(`${parcelasPendentes.length} parcela(s)`);
      if (faturasComRestante.length) {
        const totalFat = faturasComRestante.reduce((s, f) => s + f.restante, 0);
        partes.push(`fatura(s) em ${b(formatMoney(totalFat, ctx.cfg.currency))}`);
      }
      const lista = partes.join(" e ");
      return variar(ctx, {
        direto: [
          `tem ${lista} por pagar/lançar em ${ref.label}.`,
          `em ${ref.label}, ficam por pagar/lançar ${lista}.`,
        ],
        acolhedor: [`ainda tem ${lista} por pagar/lançar em ${ref.label}.`],
      });
    },
  },
  // poupança / meta (+ projeção no ritmo atual)
  //
  // Bug corrigido: \bmeta\b não bate no plural — "como vão as minhas metas?"
  // não tinha "poupança" na frase e caía direto no RESPOSTA_PADRAO, embora o
  // próprio parágrafo dos fundos logo abaixo já fosse escrito a pensar nessa
  // pergunta ("quem pergunta 'como vão as minhas metas' quer saber dos
  // dois"). `metas?` aceita as duas formas sem abrir mão da fronteira de
  // palavra (continua a não bater dentro de "metade", por exemplo).
  {
    test: (q) => /poupanc|economi|\bmetas?\b/.test(q),
    run: (q, ref, ctx) => {
      const t = totaisDoMes(ctx, ref.ym);
      const saldo = t.receitas - t.despesas;
      const meta = ctx.cfg.metaPoupanca;
      const dinheiroMeta = b(formatMoney(meta, ctx.cfg.currency));
      const dinheiroSaldo = b(formatMoney(saldo, ctx.cfg.currency));
      const situacao = saldo >= meta ? "acima" : "abaixo";
      let base = variar(ctx, {
        direto: [
          `a meta de poupança é ${dinheiroMeta}. Em ${ref.label} o saldo está em ${dinheiroSaldo} — ${situacao} da meta.`,
          `em ${ref.label} o saldo está em ${dinheiroSaldo}, ${situacao} da meta de poupança de ${dinheiroMeta}.`,
        ],
        acolhedor: [
          `a meta de poupança é ${dinheiroMeta}, e em ${ref.label} o saldo está em ${dinheiroSaldo} — ${situacao} da meta.`,
        ],
      });
      const projecao = /ritmo|projec|vou bater/.test(q) ? projecaoFimMes(ctx, ref.ym) : null;
      if (projecao !== null) {
        base += ` No ritmo actual, a projecção para o fim do mês é ${b(formatMoney(projecao, ctx.cfg.currency))} (${projecao >= meta ? "bate" : "não bate"} a meta).`;
      }
      // Os fundos respondem a outra pergunta que não a meta agregada, mas quem
      // pergunta "como vão as minhas metas" quer saber dos dois.
      const abertos = ctx.fundos
        .map((f) => progressoFundo(f, ctx.mesReal))
        .filter((p) => !p.concluido);
      if (abertos.length) {
        const comPrazo = abertos.filter((p) => p.porMes !== null);
        const totalPorMes = comPrazo.reduce((s, p) => s + (p.porMes ?? 0), 0);
        base += ` Tem ainda ${b(String(abertos.length))} fundo(s) por completar`;
        base += totalPorMes
          ? `, que pedem ${b(formatMoney(totalPorMes, ctx.cfg.currency))} por mês para baterem o prazo.`
          : " (sem prazo definido).";
      }
      return base;
    },
  },
  // o que subiu face ao costume ("o que está pesando", "o que mudou")
  //
  // Vem antes de melhor/pior mês e do resumo porque é uma pergunta sobre o
  // que MUDOU, não sobre o que o mês foi — responder com o resumo do mês
  // seria responder outra coisa.
  {
    test: (q) =>
      /o que esta pesando|o que ta pesando|esta pesando|o que mudou|por que gastei mais|porque gastei mais|gastei mais|subiu|acima da media/.test(
        q,
      ),
    run: (_q, ref, ctx) => {
      const subiram = categoriasAcimaDaMedia(ctx, ref.ym);
      if (!subiram.length)
        return variar(ctx, {
          direto: [
            `nada fora do normal em ${ref.label} — nenhuma categoria está acima da sua média.`,
            `em ${ref.label} não há nenhuma categoria acima do costume.`,
          ],
          acolhedor: [
            `em ${ref.label} está tudo dentro do seu costume — nenhuma categoria subiu.`,
            `nada a assinalar em ${ref.label}: os gastos estão em linha com os meses anteriores.`,
          ],
        });

      const moeda = ctx.cfg.currency;
      const partes = subiram
        .slice(0, 3)
        .map(
          (m) =>
            `${b(m.categoria)} ${m.desvioPct}% acima (${formatMoney(m.gastoAtual, moeda)} contra ${formatMoney(m.media, moeda)} de média)`,
        );
      const meses = subiram[0].mesesUsados;

      return variar(ctx, {
        direto: [
          `em ${ref.label}, face à média dos últimos ${meses} meses: ${partes.join("; ")}.`,
          `o que subiu em ${ref.label} (média de ${meses} meses): ${partes.join("; ")}.`,
        ],
        acolhedor: [
          `o que está a pesar mais em ${ref.label}, comparando com os últimos ${meses} meses: ${partes.join("; ")}.`,
          `em ${ref.label} há coisas acima do seu costume dos últimos ${meses} meses: ${partes.join("; ")}.`,
        ],
      });
    },
  },
  // melhor / pior mês do ano
  //
  // Bug corrigido: `ref` (o ano interpretado da pergunta, ex. "do ano
  // passado" ou "de 2024") chegava a este intent como `_ref` e nunca era
  // lido — "qual foi o pior mês do ano passado" respondia sempre com o ano
  // CORRENTE, contradizendo a própria pergunta. Agora usa `ref.year` quando
  // a pergunta traz um ano explícito (`ref.isYear`), e só cai no ano
  // corrente na ausência de qualquer pista, como os demais intents de ano.
  {
    test: (q) => /melhor mes|pior mes/.test(q),
    run: (q, ref, ctx) => {
      const anoAtual = parseInt(ctx.mesReal.slice(0, 4), 10);
      const ano = ref.isYear && ref.year !== undefined ? ref.year : anoAtual;
      const { melhor, pior } = melhorPiorMes(ctx, ano);
      const deQual = ano === anoAtual ? "do ano" : `de ${ano}`;
      const semDados = ano === anoAtual ? "este ano" : `em ${ano}`;
      const semDadosMsg = () =>
        variar(ctx, {
          direto: [`ainda não há dados suficientes ${semDados}.`],
          acolhedor: [`ainda não há dados suficientes ${semDados} para dizer isso.`],
        });
      if (q.includes("melhor")) {
        if (!melhor) return semDadosMsg();
        const dinheiro = b(formatMoney(melhor.saldo, ctx.cfg.currency));
        const mes = b(rotuloMes(melhor.ym));
        return variar(ctx, {
          direto: [
            `o melhor mês ${deQual} foi ${mes}, com saldo de ${dinheiro}.`,
            `${mes} foi o melhor mês ${deQual}, com saldo de ${dinheiro}.`,
          ],
          acolhedor: [`o mês em que mais sobrou ${deQual} foi ${mes}, com saldo de ${dinheiro}.`],
        });
      }
      if (!pior) return semDadosMsg();
      const dinheiro = b(formatMoney(pior.saldo, ctx.cfg.currency));
      const mes = b(rotuloMes(pior.ym));
      return variar(ctx, {
        direto: [
          `o pior mês ${deQual} foi ${mes}, com saldo de ${dinheiro}.`,
          `${mes} foi o pior mês ${deQual}, com saldo de ${dinheiro}.`,
        ],
        acolhedor: [`o mês mais apertado ${deQual} foi ${mes}, com saldo de ${dinheiro}.`],
      });
    },
  },
  // calendário / próximos eventos (mesma janela de 7 dias da tela Calendário)
  {
    test: (q) => /calendari|evento|agenda|proxim|compromiss/.test(q),
    run: (_q, _ref, ctx) => {
      const proximos = proximosEventos(ctx.eventos, hojeDoContexto(ctx), 7);
      if (!proximos.length)
        return variar(ctx, {
          direto: ["não há eventos agendados nos próximos 7 dias."],
          acolhedor: ["não há nada agendado nos próximos 7 dias."],
        });
      const lista = proximos
        .slice(0, 5)
        .map(
          (e) =>
            `${b(e.titulo)} em ${dataCurta(e.data)}${e.valor !== undefined ? ` (${formatMoney(e.valor, ctx.cfg.currency)})` : ""}`,
        )
        .join("; ");
      return variar(ctx, {
        direto: [`nos próximos 7 dias: ${lista}.`, `o que vem nos próximos 7 dias: ${lista}.`],
        acolhedor: [`para os próximos 7 dias, tem: ${lista}.`],
      });
    },
  },
  // resumo do mês ou do ano
  {
    test: (q) => /resumo|resume|balanco|como foi|como estou|como esta indo/.test(q),
    run: (_q, ref, ctx) => {
      if (ref.isYear && ref.year !== undefined) {
        let rec = 0;
        let desp = 0;
        for (let mi = 1; mi <= 12; mi++) {
          const ym = `${ref.year}-${String(mi).padStart(2, "0")}`;
          if (ym > ctx.mesReal) break;
          const t = totaisDoMes(ctx, ym);
          rec += t.receitas;
          desp += t.despesas;
        }
        const recD = b(formatMoney(rec, ctx.cfg.currency));
        const despD = b(formatMoney(desp, ctx.cfg.currency));
        const saldoD = b(formatMoney(rec - desp, ctx.cfg.currency));
        return variar(ctx, {
          direto: [
            `em ${ref.year} recebeu ${recD} e gastou ${despD} — saldo de ${saldoD}.`,
            `${ref.year}: ${recD} de entradas, ${despD} de saídas, saldo de ${saldoD}.`,
          ],
          acolhedor: [
            `em ${ref.year} entraram ${recD} e saíram ${despD}, deixando um saldo de ${saldoD}.`,
          ],
        });
      }
      const t = totaisDoMes(ctx, ref.ym);
      const ct = categoriasDoMes(ctx, ref.ym);
      const chaves = Object.keys(ct);
      const maior = chaves.length ? chaves.reduce((a, c) => (ct[c] > ct[a] ? c : a)) : null;
      const moeda = ctx.cfg.currency;
      const rec = b(formatMoney(t.receitas, moeda));
      const desp = b(formatMoney(t.despesas, moeda));
      const saldo = b(formatMoney(t.receitas - t.despesas, moeda));

      let msg = variar(ctx, {
        direto: [
          `em ${ref.label} recebeu ${rec} e gastou ${desp} — saldo de ${saldo}.`,
          `${ref.label}: ${rec} de entradas, ${desp} de saídas, saldo de ${saldo}.`,
          `entrou ${rec} e saiu ${desp} em ${ref.label}, ficando ${saldo}.`,
        ],
        acolhedor: [
          `em ${ref.label} entraram ${rec} e saíram ${desp}, deixando um saldo de ${saldo}.`,
          `o seu ${ref.label} fechou com ${rec} recebidos, ${desp} gastos e ${saldo} de saldo.`,
          `durante ${ref.label} recebeu ${rec} e gastou ${desp} — no fim sobraram ${saldo}.`,
        ],
      });

      if (maior) msg += ` Maior categoria: ${b(maior)} (${formatMoney(ct[maior], moeda)}).`;

      // A comparação com os meses anteriores é o que separa "gastaste X" de
      // "isto está acima do teu costume" — só entra quando há uma diferença
      // que valha a pena mencionar, para o resumo não virar sermão.
      const subiu = categoriasAcimaDaMedia(ctx, ref.ym, 25)[0];
      if (subiu && subiu.desvioPct !== null)
        msg += ` ${b(subiu.categoria)} está ${subiu.desvioPct}% acima da média dos últimos ${subiu.mesesUsados} meses.`;

      return msg;
    },
  },
  // saldo (mês ou ano)
  {
    test: (q) => q.includes("saldo"),
    run: (_q, ref, ctx) => {
      if (ref.isYear && ref.year !== undefined) {
        let rec = 0;
        let desp = 0;
        for (let mi = 1; mi <= 12; mi++) {
          const ym = `${ref.year}-${String(mi).padStart(2, "0")}`;
          if (ym > ctx.mesReal) break;
          const t = totaisDoMes(ctx, ym);
          rec += t.receitas;
          desp += t.despesas;
        }
        const dinheiro = b(formatMoney(rec - desp, ctx.cfg.currency));
        return variar(ctx, {
          direto: [
            `o saldo de ${ref.year} é ${dinheiro}.`,
            `${ref.year} fechou com ${dinheiro} de saldo.`,
          ],
          acolhedor: [`o seu saldo em ${ref.year} está em ${dinheiro}.`],
        });
      }
      const t = totaisDoMes(ctx, ref.ym);
      const valor = b(formatMoney(t.receitas - t.despesas, ctx.cfg.currency));
      return variar(ctx, {
        direto: [
          `o saldo de ${ref.label} é ${valor} (receitas menos despesas).`,
          `${ref.label} fechou com ${valor} de saldo.`,
          `saldo de ${ref.label}: ${valor}.`,
        ],
        acolhedor: [
          `o seu saldo em ${ref.label} está em ${valor}, já descontadas as despesas.`,
          `em ${ref.label} sobraram ${valor} depois de tudo o que saiu.`,
          `contas feitas, ${ref.label} deixou ${valor} de saldo.`,
        ],
      });
    },
  },
  // receitas genérico
  {
    test: (q) => /receita|recebi|entrou|ganhei|\bganho\b|salario|ordenado|rendimento/.test(q),
    run: (_q, ref, ctx) => {
      const dinheiro = b(formatMoney(totaisDoMes(ctx, ref.ym).receitas, ctx.cfg.currency));
      return variar(ctx, {
        direto: [`recebeu ${dinheiro} em ${ref.label}.`, `entraram ${dinheiro} em ${ref.label}.`],
        acolhedor: [`em ${ref.label} entraram ${dinheiro}.`],
      });
    },
  },
  // despesas genérico
  //
  // Bug corrigido: \bgasto\b não bate no plural — "quais foram meus gastos em
  // julho?" não tinha "despes" nem "gastei" na frase e caía sem responder,
  // igual ao mesmo furo já corrigido para "meta"/"metas" no intent de
  // poupança. `gastos?` aceita as duas formas sem abrir mão da fronteira de
  // palavra.
  {
    test: (q) => /despes|gastei|\bgastos?\b|\bsaiu\b|\bsaida\b|torrei/.test(q),
    run: (_q, ref, ctx) => {
      const dinheiro = b(formatMoney(totaisDoMes(ctx, ref.ym).despesas, ctx.cfg.currency));
      return variar(ctx, {
        direto: [`gastou ${dinheiro} em ${ref.label}.`, `saíram ${dinheiro} em ${ref.label}.`],
        acolhedor: [`em ${ref.label} saíram ${dinheiro}.`],
      });
    },
  },
];

/** Devolvida quando nenhum intent soube responder.
 *
 *  Exportada porque é o SINAL que liga a camada 2: quem chama compara a
 *  resposta com esta constante para saber se vale a pena tentar a IA. Deixou
 *  de ser texto que chega sozinho ao ecrã. */
export const RESPOSTA_PADRAO =
  "Ainda não sei responder a isso. Pergunte sobre categorias, orçamento, poupança, parcelas, cartões ou peça um resumo do mês.";

/** Resposta 100% local e determinística — camada 1, sem rede nenhuma.
 *
 *  Continua síncrona de propósito: é o caminho de todas as perguntas que a app
 *  sabe responder sozinha, e não deve pagar o custo de ser assíncrona por
 *  causa do caso em que falha. Quem quiser a camada 2 compara o retorno com
 *  `RESPOSTA_PADRAO` e decide daí. */
export function responderPergunta(pergunta: string, ctx: ContextoCopiloto): string {
  const q = normalizarPergunta(pergunta);
  // A pergunta sem mês nomeado fala do mês que a pessoa está a VER, não do mês
  // de hoje — o `mesReal` continua a ser usado dentro dos intents, mas só para
  // o que depende mesmo da data de hoje (uma fixa em débito automático já ter
  // vencido, a projeção "no ritmo atual" só valer para o mês corrente).
  const ref = interpretarReferencia(q, ctx.mesVisivel ?? ctx.mesReal, ctx.mesReal);
  for (const intent of INTENTS_COPILOTO) {
    if (intent.test(q, ctx)) {
      const resposta = intent.run(q, ref, ctx);
      if (resposta != null) return resposta;
    }
  }
  return RESPOSTA_PADRAO;
}
