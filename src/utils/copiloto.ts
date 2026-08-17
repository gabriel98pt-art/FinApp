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
import { calcularFatura, fixaAtivaNoMes, fixaEfetivamentePaga, type DadosFatura } from "./fatura";
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
 *  mês corrente. Portado de _cpParseRef. */
export function interpretarReferencia(pergunta: string, mesCorrente: YearMonth): ReferenciaTempo {
  const q = normalizarPergunta(pergunta);
  if (q.includes("mes passado"))
    return { ym: somarMeses(mesCorrente, -1), label: rotuloMes(somarMeses(mesCorrente, -1)) };
  if (q.includes("este mes") || q.includes("mes atual"))
    return { ym: mesCorrente, label: rotuloMes(mesCorrente) };

  const anoAtual = parseInt(mesCorrente.slice(0, 4), 10);
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
      if (!anoDaPergunta && ym > mesCorrente) ym = `${y - 1}-${String(mi + 1).padStart(2, "0")}`;
      return { ym, label: rotuloMes(ym) };
    }
  }

  // isYear: ainda assim carrega ym/label do mês corrente (fallback honesto
  // pros intents que não tratam isYear explicitamente)
  if (anoPassado)
    return { ym: mesCorrente, label: rotuloMes(mesCorrente), isYear: true, year: anoAtual - 1 };
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
   *  sentido (só quando a pergunta é sobre o mês corrente de verdade). */
  mesReal: YearMonth;
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
  return {
    despesasFixas: ctx.despesasFixas,
    despesasFixasVeiculo: ctx.veiculo.despesasFixas,
    despesasCorrentes: ctx.despesas,
    parcelas: ctx.parcelas,
    transferencias: ctx.transferencias ?? [],
    cargas: ctx.veiculo.cargas,
    despesasVeiculo: ctx.veiculo.despesas,
    receitas: ctx.receitas,
  };
}

/** '2026-07-05' → '05/07'. Dia e mês bastam onde o ano é o do contexto. */
export function dataCurta(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
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
 *  nome ("Gabriel, em julho…"); sem nome, capitaliza-se aqui. */
function variar(ctx: ContextoCopiloto, frases: FrasesPorTom): string {
  const tom = ctx.cfg.copiloto?.tom ?? "direto";
  const lista = frases[tom].length ? frases[tom] : frases.direto;
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
  // combustível / carregamento elétrico
  {
    test: (q) => /combust|gasolina|carregament|abasteci/.test(q),
    run: (q, ref, ctx) => {
      if (q.includes("ultimo") || q.includes("ultima")) {
        const ordenadas = [...ctx.veiculo.cargas].sort((a, b2) => (a.data < b2.data ? 1 : -1));
        if (!ordenadas.length) return "Ainda não há registos de combustível/carregamento.";
        const c = ordenadas[0];
        return `O último carregamento foi em ${b(dataCurta(c.data))}${c.local ? ` em ${b(c.local)}` : ""}, no valor de ${b(formatMoney(c.custo, ctx.cfg.currency))}.`;
      }
      const total = totalCargasMes(ctx.veiculo, ref.ym);
      return total > 0
        ? `Gastou ${b(formatMoney(total, ctx.cfg.currency))} em combustível/carregamento em ${ref.label}.`
        : `Não há gastos de combustível/carregamento registados em ${ref.label}.`;
    },
  },
  // manutenção / limpeza do veículo
  {
    test: (q) => /manutenc|limpeza|lavagem/.test(q),
    run: (_q, ref, ctx) => {
      const total = totalDespesasVeiculoMes(ctx.veiculo, ref.ym);
      return total > 0
        ? `Gastou ${b(formatMoney(total, ctx.cfg.currency))} em manutenção/limpeza do veículo em ${ref.label}.`
        : `Não há gastos de manutenção/limpeza registados em ${ref.label}.`;
    },
  },
  // veículo genérico (soma tudo: cargas + despesas + fixas)
  //
  // Chama `totalVeiculoMes` directamente, sem passar por `totaisDoMes` nem
  // `categoriasDoMes` — foi por isso que escapou à correção de 617d305 e
  // continuou a contar o seguro do dia 28 já no dia 3.
  {
    test: (q) => /veiculo|\bcarro\b/.test(q),
    run: (_q, ref, ctx) =>
      `O total gasto com o veículo em ${ref.label} foi ${b(formatMoney(totalVeiculoMes(ctx.veiculo, ref.ym, ctx.mesReal, hojeDoContexto(ctx)), ctx.cfg.currency))} (combustível, manutenção e despesas fixas).`,
  },
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
      if (!abertos.length) return `A parcela ${b(p.descricao)} já está totalmente paga.`;
      const restante = abertos.reduce((s, m) => s + valorDaParcela(p, m), 0);
      return `Faltam ${b(String(abertos.length))} parcela(s) de ${b(p.descricao)}, no total de ${b(formatMoney(restante, ctx.cfg.currency))}. Próxima em ${b(rotuloMes(abertos[0]))}.`;
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
      return n
        ? `Tem ${b(String(n))} parcela(s) por pagar, no total de ${b(formatMoney(total, ctx.cfg.currency))}.`
        : "Não há parcelas em aberto.";
    },
  },
  // cartão específico
  {
    test: (q, ctx) => q.includes("cartao") && !!encontrarNaLista(q, ctx.cfg.contasCartoes, 5),
    run: (q, ref, ctx) => {
      const cartao = encontrarNaLista(q, ctx.cfg.contasCartoes, 5)!;
      const total = ctx.despesas
        .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ref.ym)
        .reduce((s, d) => s + d.valor, 0);
      return `Gastou ${b(formatMoney(total, ctx.cfg.currency))} no cartão ${b(cartao)} em ${ref.label}.`;
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
          cartao,
          total: ctx.despesas
            .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ref.ym)
            .reduce((s, d) => s + d.valor, 0),
        }))
        .sort((a, b2) => b2.total - a.total);
      if (!linhas[0].total) return `Não há despesas em nenhum cartão em ${ref.label}.`;
      return `O cartão mais usado em ${ref.label} foi ${b(linhas[0].cartao)}, com ${b(formatMoney(linhas[0].total, ctx.cfg.currency))} em despesas.`;
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
      return total > 0
        ? `Recebeu ${b(formatMoney(total, ctx.cfg.currency))} de ${b(fonte)} em ${ref.label}.`
        : `Não há receitas de ${b(fonte)} registadas em ${ref.label}.`;
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
      const base = `O fundo ${b(fundo.nome)} está em ${b(formatMoney(fundo.atual, moeda))} de ${b(formatMoney(fundo.alvo, moeda))} (${p.pct}%).`;

      if (p.concluido) return `${base} Já chegou ao alvo.`;
      if (p.prazoVencido)
        return `${base} Faltam ${b(formatMoney(p.falta, moeda))} e o prazo (${b(rotuloMes(mesDe(fundo.prazo!)))}) já passou.`;
      if (p.porMes === null || p.mesesRestantes === null)
        return `${base} Faltam ${b(formatMoney(p.falta, moeda))}. Sem prazo definido, não dá para dizer quanto por mês.`;

      return `${base} Faltam ${b(formatMoney(p.falta, moeda))}. Até ${b(rotuloMes(mesDe(fundo.prazo!)))} são ${b(String(p.mesesRestantes))} mês(es) — dá cerca de ${b(formatMoney(p.porMes, moeda))} por mês.`;
    },
  },
  // categoria de despesa específica
  {
    test: (q, ctx) => !!encontrarNaLista(q, ctx.cfg.categoriasDespesa),
    run: (q, ref, ctx) => {
      const cat = encontrarNaLista(q, ctx.cfg.categoriasDespesa)!;
      const ct = categoriasDoMes(ctx, ref.ym);
      const val = ct[cat] || 0;
      if (!val)
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
  // orçamento (categorias com teto configurado — seção 4.8)
  {
    test: (q) => /orcament|dentro do/.test(q),
    run: (_q, ref, ctx) => {
      const categorias = Object.keys(ctx.cfg.orcamentos).filter((c) => ctx.cfg.orcamentos[c] > 0);
      if (!categorias.length) return "Ainda não há orçamento definido por categoria.";
      const ct = categoriasDoMes(ctx, ref.ym);
      const estourou = categorias.filter((cat) => (ct[cat] || 0) > ctx.cfg.orcamentos[cat]);
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
    test: (q) => q.includes("pendente"),
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
        return `Não há pendentes em ${ref.label}.`;
      const partes: string[] = [];
      if (parcelasPendentes.length) partes.push(`${parcelasPendentes.length} parcela(s)`);
      if (faturasComRestante.length) {
        const totalFat = faturasComRestante.reduce((s, f) => s + f.restante, 0);
        partes.push(`fatura(s) em ${b(formatMoney(totalFat, ctx.cfg.currency))}`);
      }
      return `Tem ${partes.join(" e ")} por pagar/lançar em ${ref.label}.`;
    },
  },
  // poupança / meta (+ projeção no ritmo atual)
  {
    test: (q) => /poupanc|\bmeta\b/.test(q),
    run: (q, ref, ctx) => {
      const t = totaisDoMes(ctx, ref.ym);
      const saldo = t.receitas - t.despesas;
      const meta = ctx.cfg.metaPoupanca;
      let base = `A meta de poupança é ${b(formatMoney(meta, ctx.cfg.currency))}. Em ${ref.label} o saldo está em ${b(formatMoney(saldo, ctx.cfg.currency))} — ${saldo >= meta ? "acima" : "abaixo"} da meta.`;
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
      if (q.includes("melhor"))
        return melhor
          ? `O melhor mês ${deQual} foi ${b(rotuloMes(melhor.ym))}, com saldo de ${b(formatMoney(melhor.saldo, ctx.cfg.currency))}.`
          : `Ainda não há dados suficientes ${semDados}.`;
      return pior
        ? `O pior mês ${deQual} foi ${b(rotuloMes(pior.ym))}, com saldo de ${b(formatMoney(pior.saldo, ctx.cfg.currency))}.`
        : `Ainda não há dados suficientes ${semDados}.`;
    },
  },
  // calendário / próximos eventos (mesma janela de 7 dias da tela Calendário)
  {
    test: (q) => /calendari|evento|agenda|proxim/.test(q),
    run: (_q, _ref, ctx) => {
      const proximos = proximosEventos(ctx.eventos, hojeDoContexto(ctx), 7);
      if (!proximos.length) return "Não há eventos agendados nos próximos 7 dias.";
      return (
        "Nos próximos 7 dias: " +
        proximos
          .slice(0, 5)
          .map(
            (e) =>
              `${b(e.titulo)} em ${dataCurta(e.data)}${e.valor !== undefined ? ` (${formatMoney(e.valor, ctx.cfg.currency)})` : ""}`,
          )
          .join("; ") +
        "."
      );
    },
  },
  // resumo do mês ou do ano
  {
    test: (q) => /resumo|resume|como foi|como estou/.test(q),
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
        return `Em ${ref.year} recebeu ${b(formatMoney(rec, ctx.cfg.currency))} e gastou ${b(formatMoney(desp, ctx.cfg.currency))} — saldo de ${b(formatMoney(rec - desp, ctx.cfg.currency))}.`;
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
        return `O saldo de ${ref.year} é ${b(formatMoney(rec - desp, ctx.cfg.currency))}.`;
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
    test: (q) => /receita|recebi|entrou|ganhei/.test(q),
    run: (_q, ref, ctx) =>
      `Recebeu ${b(formatMoney(totaisDoMes(ctx, ref.ym).receitas, ctx.cfg.currency))} em ${ref.label}.`,
  },
  // despesas genérico
  {
    test: (q) => /despes|gastei|\bgasto\b/.test(q),
    run: (_q, ref, ctx) =>
      `Gastou ${b(formatMoney(totaisDoMes(ctx, ref.ym).despesas, ctx.cfg.currency))} em ${ref.label}.`,
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
  const ref = interpretarReferencia(q, ctx.mesReal);
  for (const intent of INTENTS_COPILOTO) {
    if (intent.test(q, ctx)) {
      const resposta = intent.run(q, ref, ctx);
      if (resposta != null) return resposta;
    }
  }
  return RESPOSTA_PADRAO;
}
