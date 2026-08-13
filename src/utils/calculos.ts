// Funções puras de agregação — sempre em centavos inteiros (seção 4.2),
// sem dependência de Firebase/DOM. Comportamento portado do js/calc.js antigo.

import type { Cents, IsoDate, YearMonth } from "../types";

export interface ItemComValor {
  valor: Cents;
  data: IsoDate;
}

/** 'YYYY-MM-DD' → 'YYYY-MM' por corte de string — evita Date/timezone. */
export function mesDe(data: IsoDate): YearMonth {
  return data.slice(0, 7);
}

export function total(itens: ItemComValor[]): Cents {
  return itens.reduce((acc, i) => acc + i.valor, 0);
}

export function doMes<T extends ItemComValor>(itens: T[], anoMes: YearMonth): T[] {
  return itens.filter((i) => mesDe(i.data) === anoMes);
}

export function totalDoMes(itens: ItemComValor[], anoMes: YearMonth): Cents {
  return total(doMes(itens, anoMes));
}

/** Variação percentual de um total mensal contra o do mês anterior,
 *  arredondada ao inteiro.
 *
 *  `null` quando não há base de comparação. O mês anterior a zero é o caso
 *  óbvio (primeiro mês de uso do app), mas negativo conta igual: com um
 *  reembolso maior que os gastos, um mês de despesa pode fechar abaixo de zero
 *  e a percentagem contra ele inverte o sinal sem querer ("gastou mais" vira
 *  "-30%"). Dividir por zero daria Infinity e "subiu ∞%" não se lê. Quem chama
 *  decide o que mostrar no lugar — o cartão não desaparece por isto. */
export function variacaoMensal(atual: Cents, anterior: Cents): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/** '+12%' / '-8%' / '0%'. O sinal explícito é o ponto do cartão: sem ele,
 *  "12%" não diz se subiu ou desceu. */
export function rotuloVariacao(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export interface MediaMensal {
  /** Média do total mensal, ao centavo. */
  media: Cents;
  /** Quantos dos meses pedidos tinham história e entraram na conta — o cartão
   *  precisa disto para não prometer três meses quando só houve um. */
  meses: number;
}

/** Média do total mensal ao longo de `meses`, contando só os meses que já
 *  existiam — do mês do lançamento mais antigo em diante.
 *
 *  A distinção importa num app novo, e é a diferença entre um número útil e um
 *  número errado. Um mês vazio DEPOIS de a pessoa começar a usar é um zero
 *  verdadeiro e tem de entrar na média: houve o mês, não houve receita. Um mês
 *  ANTES disso não é zero, é ausência de dados — dividir por três fixo mostrava
 *  a terça parte do que a pessoa recebe a quem só tem um mês de história, e o
 *  cartão que devia servir de referência passava a mentir para baixo.
 *
 *  `null` quando nenhum dos meses pedidos tem história. */
export function mediaMensal(itens: ItemComValor[], meses: YearMonth[]): MediaMensal | null {
  if (itens.length === 0 || meses.length === 0) return null;
  const primeiroMes = mesDe(itens.reduce((min, i) => (i.data < min ? i.data : min), itens[0].data));
  const comHistoria = meses.filter((m) => m >= primeiroMes);
  if (comHistoria.length === 0) return null;
  const soma = comHistoria.reduce((acc, m) => acc + totalDoMes(itens, m), 0);
  return { media: Math.round(soma / comHistoria.length), meses: comHistoria.length };
}

export interface ResumoMes {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Resumo de um mês: receitas, despesas e saldo (receitas − despesas). */
export function resumoMes(
  receitas: ItemComValor[],
  despesas: ItemComValor[],
  anoMes: YearMonth,
): ResumoMes {
  const r = totalDoMes(receitas, anoMes);
  const d = totalDoMes(despesas, anoMes);
  return { receitas: r, despesas: d, saldo: r - d };
}

/** Saldo acumulado de todos os lançamentos. */
export function saldoTotal(receitas: ItemComValor[], despesas: ItemComValor[]): Cents {
  return total(receitas) - total(despesas);
}

/** Data de hoje no fuso local, como 'YYYY-MM-DD'. */
export function hojeIso(): IsoDate {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function mesAtual(): YearMonth {
  return mesDe(hojeIso());
}

/** Soma n meses a um 'YYYY-MM' (n pode ser negativo). */
export function somarMeses(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Últimos n meses terminando em `ate` (incluído), em ordem crescente.
 *  Portado de getLast(n, from). */
export function mesesRecentes(n: number, ate: YearMonth): YearMonth[] {
  const meses: YearMonth[] = [];
  for (let i = n - 1; i >= 0; i--) meses.push(somarMeses(ate, -i));
  return meses;
}

/** Soma n dias a uma data 'YYYY-MM-DD' (n pode ser negativo). Usa meio-dia
 *  UTC pra não escorregar de dia por causa de DST. */
export function somarDias(data: IsoDate, n: number): IsoDate {
  const [y, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Dias inteiros de `de` até `ate` — negativo quando `ate` é anterior. Mesmo
 *  meio-dia UTC de `somarDias`, pelo mesmo motivo (DST). */
export function diasEntre(de: IsoDate, ate: IsoDate): number {
  const emUtc = (d: IsoDate) => {
    const [y, m, dia] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dia, 12);
  };
  return Math.round((emUtc(ate) - emUtc(de)) / 86400000);
}

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
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

/** 'jan', 'fev', … — para grades onde o nome inteiro não cabe. */
export const MESES_CURTOS_PT = MESES_PT.map((m) => m.slice(0, 3));

/** '2026-07-15' → 15. Irmão de `mesDe`: corta a string, sem passar por Date. */
export function diaDe(data: IsoDate): number {
  return Number(data.slice(8, 10));
}

/** Data do dia `dia` nesse mês, presa ao que o mês tem: um vencimento a 31
 *  cai no dia 28 em fevereiro, em vez de escorregar pra março. Sem `dia` (ou
 *  0), cai no dia 1 — só pra ter um lugar na ordenação. Vive aqui (módulo sem
 *  dependência de parcela/fixa/fatura) pra dar pra usar de qualquer um deles
 *  sem import circular. */
export function diaDoMes(ym: YearMonth, dia?: number): IsoDate {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(dia || 1, 1), ultimo);
  return `${ym}-${String(d).padStart(2, "0")}`;
}

/** '2026-07' → 'julho 2026'. */
export function rotuloMes(ym: YearMonth): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_PT[(m ?? 1) - 1]} ${y}`;
}

/** '2026-07' → 2026. */
export function anoDe(ym: YearMonth): number {
  return Number(ym.slice(0, 4));
}

/** (2026, 7) → '2026-07'. */
export function mesDoAno(ano: number, mes1a12: number): YearMonth {
  return `${ano}-${String(mes1a12).padStart(2, "0")}`;
}

/** Filtra os lançamentos que CONTAM como despesa nos KPIs/resumos.
 *  Pagamentos de fatura (origem 'fat') ficam de fora: a compra no cartão já
 *  contou como despesa no mês dela — contar também o pagamento seria contar
 *  duas vezes (bug conhecido do app antigo, seção 4.1, a não reproduzir).
 *  O destino claro deles é a tela Cartões (total pago da fatura). */
/** Exclui pagamentos de fatura ('fat'), ajustes de reconciliação bancária
 *  ('recon') e o lançamento espelho de parcela ('parc') dos totais (mesma
 *  regra do app de referência, `totCorrManual`: `!d._src`):
 *  - 'fat' e 'recon' não são despesa real;
 *  - 'parc' É despesa real, mas já conta pelo plano da parcela
 *    (`contribuicaoParcelasMes`, utils/parcelas.ts) — somar o espelho também
 *    contaria duas vezes. O espelho continua existindo para outros fins
 *    (extrato por conta, histórico), só não entra nesta soma. */
export function despesasNosTotais<T extends { origem?: string }>(itens: T[]): T[] {
  return itens.filter((d) => d.origem !== "fat" && d.origem !== "recon" && d.origem !== "parc");
}

/** O espelho de `despesasNosTotais` do lado da receita: exclui o ajuste de
 *  reconciliação bancária para cima, que existe só para o saldo da conta bater
 *  com o banco e não é dinheiro que alguém recebeu. Mesma regra do app de
 *  referência (`r._src !== 'recon'`, em todos os totais de receita dele).
 *
 *  Só 'recon' se aplica aqui — 'fat' e 'parc' são casos exclusivos da despesa.
 *  O ajuste continua a aparecer na lista de lançamentos e continua a contar no
 *  saldo da conta (utils/contas.ts), que é justamente o que ele veio corrigir. */
export function receitasNosTotais<T extends { origem?: string }>(itens: T[]): T[] {
  return itens.filter((r) => r.origem !== "recon");
}

/** Ordena por data decrescente (mais recente primeiro), estável. */
export function ordenarPorDataDesc<T extends ItemComValor>(itens: T[]): T[] {
  return [...itens].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
