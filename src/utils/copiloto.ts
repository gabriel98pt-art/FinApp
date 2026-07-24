// Copiloto — motor de perguntas em linguagem natural (seção 3.9), portado do
// financas.html (_CP_INTENTS e vizinhos). ZERO IA externa: resposta sempre
// calculada localmente a partir do estado real da conta, determinística.
// Lista ordenada de intents (mais específico → mais genérico); o primeiro
// cujo test() bate vence.

import type {
  Cents,
  ConfigConta,
  DadosVeiculo,
  DespesaCorrente,
  EventoCalendario,
  Parcela,
  Receita,
  YearMonth,
} from "../types";
import { doMes, mesDe, rotuloMes, somarMeses, totalDoMes } from "./calculos";
import { proximosEventos } from "./calendario";
import { calcularFatura, type DadosFatura } from "./fatura";
import { mesesNaoPagos, valorDaParcela } from "./parcelas";
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

  const anoMatch = q.match(/\b(20\d{2})\b/);
  const anoDaPergunta = anoMatch ? parseInt(anoMatch[1], 10) : null;
  const palavras = q.split(/[^a-z0-9]+/);
  for (const w of palavras) {
    const mi = indiceDoMes(w);
    if (mi > -1) {
      const y = anoDaPergunta ?? parseInt(mesCorrente.slice(0, 4), 10);
      let ym = `${y}-${String(mi + 1).padStart(2, "0")}`;
      if (!anoDaPergunta && ym > mesCorrente) ym = `${y - 1}-${String(mi + 1).padStart(2, "0")}`;
      return { ym, label: rotuloMes(ym) };
    }
  }

  // isYear: ainda assim carrega ym/label do mês corrente (fallback honesto
  // pros intents que não tratam isYear explicitamente)
  const anoAtual = parseInt(mesCorrente.slice(0, 4), 10);
  if (q.includes("ano passado"))
    return { ym: mesCorrente, label: rotuloMes(mesCorrente), isYear: true, year: anoAtual - 1 };
  if (/\bano\b/.test(q))
    return { ym: mesCorrente, label: rotuloMes(mesCorrente), isYear: true, year: anoAtual };

  return { ym: mesCorrente, label: rotuloMes(mesCorrente) };
}

export interface ContextoCopiloto {
  receitas: Receita[];
  /** Já sem pagamentos de fatura (origem 'fat') — ver despesasNosTotais. */
  despesas: DespesaCorrente[];
  parcelas: Parcela[];
  cfg: ConfigConta;
  veiculo: DadosVeiculo;
  eventos: EventoCalendario[];
  /** Mês real de hoje — usado pra decidir se "projeção no ritmo atual" faz
   *  sentido (só quando a pergunta é sobre o mês corrente de verdade). */
  mesReal: YearMonth;
  diaDeHoje: number;
}

/** 'YYYY-MM-DD' de hoje, reconstruído de mesReal+diaDeHoje (mesma fonte que
 *  o resto do contexto, sem introduzir um terceiro "agora" independente). */
function hojeDoContexto(ctx: ContextoCopiloto): string {
  return `${ctx.mesReal}-${String(ctx.diaDeHoje).padStart(2, "0")}`;
}

/** Despesas do mês somando veículo (Parte A) — fonte única com o resto do app. */
function totaisDoMes(ctx: ContextoCopiloto, ym: YearMonth) {
  const despesas = totalDoMes(ctx.despesas, ym) + totalVeiculoMes(ctx.veiculo, ym, ctx.mesReal);
  return { receitas: totalDoMes(ctx.receitas, ym), despesas };
}

/** Breakdown por categoria do mês, com o veículo entrando num bucket
 *  'Veículo' único (mesmo padrão do _cpCatTotals da origem). */
function categoriasDoMes(ctx: ContextoCopiloto, ym: YearMonth): Record<string, Cents> {
  const ct: Record<string, Cents> = {};
  for (const d of doMes(ctx.despesas, ym)) ct[d.categoria] = (ct[d.categoria] || 0) + d.valor;
  const totalVeic = totalVeiculoMes(ctx.veiculo, ym, ctx.mesReal);
  if (totalVeic > 0) ct["Veículo"] = (ct["Veículo"] || 0) + totalVeic;
  return ct;
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

function dadosFaturaDoContexto(ctx: ContextoCopiloto): DadosFatura {
  return {
    despesasFixas: [],
    despesasFixasVeiculo: ctx.veiculo.despesasFixas,
    despesasCorrentes: ctx.despesas,
    parcelas: ctx.parcelas,
    transferencias: [],
  };
}

function dataCurta(d: string): string {
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
 *  '<img onerror=...>' viraria XSS armazenado. */
function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const b = (s: string) => `<b>${escaparHtml(s)}</b>`;

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
  {
    test: (q) => /veiculo|\bcarro\b/.test(q),
    run: (_q, ref, ctx) =>
      `O total gasto com o veículo em ${ref.label} foi ${b(formatMoney(totalVeiculoMes(ctx.veiculo, ref.ym, ctx.mesReal), ctx.cfg.currency))} (combustível, manutenção e despesas fixas).`,
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
      const abertos = mesesNaoPagos(p);
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
        for (const m of mesesNaoPagos(p)) {
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
  // categoria de despesa específica
  {
    test: (q, ctx) => !!encontrarNaLista(q, ctx.cfg.categoriasCorrentes),
    run: (q, ref, ctx) => {
      const cat = encontrarNaLista(q, ctx.cfg.categoriasCorrentes)!;
      const ct = categoriasDoMes(ctx, ref.ym);
      const val = ct[cat] || 0;
      if (!val) return `Não há gastos em ${b(cat)} em ${ref.label}.`;
      const totalDesp = Object.values(ct).reduce((s, v) => s + v, 0);
      const pct = totalDesp > 0 ? Math.round((val / totalDesp) * 100) : 0;
      return `Gastou ${b(formatMoney(val, ctx.cfg.currency))} em ${b(cat)} em ${ref.label} — ${pct}% do total de despesas do mês.`;
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
        return `Está dentro do orçamento em todas as categorias em ${ref.label}.`;
      return `Está a ultrapassar o orçamento em ${ref.label} em: ${b(estourou.join(", "))}.`;
    },
  },
  // pendências: parcelas do mês em aberto + faturas de cartão com restante
  {
    test: (q) => q.includes("pendente"),
    run: (_q, ref, ctx) => {
      const parcelasPendentes = ctx.parcelas.filter((p) => mesesNaoPagos(p).includes(ref.ym));
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
      if (/ritmo|projec|vou bater/.test(q) && ref.ym === ctx.mesReal && ctx.diaDeHoje > 0) {
        const [ay, am] = ref.ym.split("-").map(Number);
        const ultimoDia = new Date(ay, am, 0).getDate();
        const projecao = Math.round((saldo / ctx.diaDeHoje) * ultimoDia);
        base += ` No ritmo actual, a projecção para o fim do mês é ${b(formatMoney(projecao, ctx.cfg.currency))} (${projecao >= meta ? "bate" : "não bate"} a meta).`;
      }
      return base;
    },
  },
  // melhor / pior mês do ano
  {
    test: (q) => /melhor mes|pior mes/.test(q),
    run: (q, _ref, ctx) => {
      const { melhor, pior } = melhorPiorMes(ctx, parseInt(ctx.mesReal.slice(0, 4), 10));
      if (q.includes("melhor"))
        return melhor
          ? `O melhor mês do ano foi ${b(rotuloMes(melhor.ym))}, com saldo de ${b(formatMoney(melhor.saldo, ctx.cfg.currency))}.`
          : "Ainda não há dados suficientes este ano.";
      return pior
        ? `O pior mês do ano foi ${b(rotuloMes(pior.ym))}, com saldo de ${b(formatMoney(pior.saldo, ctx.cfg.currency))}.`
        : "Ainda não há dados suficientes este ano.";
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
      let msg = `Em ${ref.label} recebeu ${b(formatMoney(t.receitas, ctx.cfg.currency))} e gastou ${b(formatMoney(t.despesas, ctx.cfg.currency))} — saldo de ${b(formatMoney(t.receitas - t.despesas, ctx.cfg.currency))}.`;
      if (maior)
        msg += ` Maior categoria: ${b(maior)} (${formatMoney(ct[maior], ctx.cfg.currency)}).`;
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
      return `O saldo de ${ref.label} é ${b(formatMoney(t.receitas - t.despesas, ctx.cfg.currency))} (receitas menos despesas).`;
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

const RESPOSTA_PADRAO =
  "Ainda não sei responder a isso. Pergunte sobre categorias, orçamento, poupança, parcelas, cartões ou peça um resumo do mês.";

/** Zero IA — resposta 100% local e determinística (decisão deliberada,
 *  seção 3.9: custo e privacidade). */
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
