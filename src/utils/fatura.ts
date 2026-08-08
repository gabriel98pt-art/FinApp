// Fatura de cartão de crédito (seção 4.1) — a lógica financeira mais delicada
// do app. Funções puras, tudo em centavos inteiros. Comportamento portado do
// app de referência; os 3 bugs conhecidos NÃO são reproduzidos:
//  1. pagamentos de fatura (origem 'fat') ficam fora do próprio cálculo E dos
//     totais de despesa (ver despesasNosTotais em calculos.ts);
//  2. nada fica invisível: parcelas autoDebit quitadas via fatura geram o seu
//     lançamento mensal normal (faturaService);
//  3. o devido é SEMPRE recalculado ao vivo — nunca congelamos um valor.
//     Se um lançamento novo entrar num ciclo já pago, a fatura volta a mostrar
//     restante > 0 (reabre de forma visível), em vez de manter valor velho.

import type {
  CargaEletrica,
  Cents,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  FaturaCalculada,
  IsoDate,
  PagamentoFatura,
  Parcela,
  Transferencia,
  YearMonth,
} from "../types";
import { diaDoMes, mesDe, somarMeses } from "./calculos";
import { mesesDaParcela, valorDaParcela } from "./parcelas";
import { toCents } from "./money";

/** Ciclo coberto pela fatura de um mês: o mês civil ANTERIOR inteiro — o
 *  cartão fecha no fim do mês e cobra no seguinte (fatura de julho = gastos
 *  de junho; regra confirmada pelo dono no app de referência). Isolado aqui
 *  para um futuro ciclo configurável por cartão. */
export function cicloDaFatura(mesFatura: YearMonth): YearMonth {
  return somarMeses(mesFatura, -1);
}

/** A que ciclo (mês civil) uma DATA pertence, dado o dia de fechamento do
 *  cartão. Sem `diaFechamento`, o ciclo é o mês civil da própria data — o
 *  cartão fecha sempre no último dia do mês, comportamento de sempre.
 *
 *  Com `diaFechamento`, uma compra feita DEPOIS dele já pertence ao ciclo do
 *  mês seguinte (ex.: fechamento dia 5 — uma compra no dia 6 de junho entra
 *  no ciclo de julho, não no de junho). Até ao dia de fechamento (inclusive),
 *  fica no mês em que aconteceu. */
export function mesDoCiclo(data: IsoDate, diaFechamento?: number): YearMonth {
  const ym = mesDe(data);
  if (!diaFechamento) return ym;
  const fechamento = diaDoMes(ym, diaFechamento);
  return data > fechamento ? somarMeses(ym, 1) : ym;
}

/** Uma despesa fixa está ativa num mês se o mês cai dentro de [inicio, fim]. */
export function fixaAtivaNoMes(d: DespesaFixa, ym: YearMonth): boolean {
  if (d.inicio && ym < d.inicio) return false;
  if (d.fim && ym > d.fim) return false;
  return true;
}

/** Este mês da fixa já está resolvido? Mesma regra de `estaEfetivamentePaga`
 *  (utils/parcelas.ts), agora para a DespesaFixa:
 *
 *  marcada à mão conta sempre; e quando sai por CARTÃO em débito automático,
 *  conta também qualquer mês até ao de referência, sem toque nenhum — que é a
 *  promessa do débito automático. Sem isso, uma fixa que ninguém marca (porque
 *  não é preciso marcar) nunca aparecia como paga: sumia do extrato e dos
 *  totais do mês corrente, apesar de o cálculo da fatura já a cobrar.
 *
 *  Sem `mesReferencia` conta só o que está marcado — o comportamento de
 *  sempre, para quem chama sem se importar com o mês de hoje.
 *
 *  Com `hoje`, o MÊS corrente ganha precisão de DIA — mesma razão de
 *  `estaEfetivamentePaga` (utils/parcelas.ts): uma fixa que vence dia 27 não
 *  pode contar como paga no dia 8 só porque agosto já começou, senão o
 *  extrato de Transações mostra uma cobrança do dia 27 como já feita no dia 8,
 *  com data no futuro. Sem `hoje`, quem chama não se importa com o dia — o
 *  mês inteiro de uma vez, como sempre (ex. as notificações do sino, que
 *  tratam débito automático como nunca sendo pendência, dia nenhum importa). */
export function fixaEfetivamentePaga(
  f: DespesaFixa,
  mes: YearMonth,
  mesReferencia?: YearMonth,
  hoje?: IsoDate,
): boolean {
  // `pagoPorMes` pode vir indefinido: o RTDB apaga objetos vazios.
  if (f.pagoPorMes?.[mes]) return true;
  if (!mesReferencia || !f.contaCartao || !f.autoDebit || mes > mesReferencia) return false;
  // O mês tem de estar dentro do plano da fixa — quem chama nem sempre filtra
  // por isso antes (o extrato de Transações percorre todas), e sem esta linha
  // uma fixa passava a "paga" em meses anteriores ao seu início.
  if (!fixaAtivaNoMes(f, mes)) return false;
  if (mes < mesReferencia || !hoje) return true;
  // Sem diaVencimento não há como saber o dia certo — mais seguro esperar o
  // fim do mês do que supor logo o dia 1 (o padrão de diaDoMes sem dia).
  return diaDoMes(mes, f.diaVencimento ?? 31) <= hoje;
}

/** Todos os meses em que a fixa já saiu sozinha do cartão, do início até hoje
 *  — a versão "toda a vida da fixa" de `fixaEfetivamentePaga`, para os totais
 *  acumulados.
 *
 *  Devolve vazio quando não há `inicio`: sem ele não há como saber até onde
 *  recuar, e inventar um ponto de partida mexia num total que o usuário já vê.
 *  Essas continuam a contar só os meses marcados à mão. */
export function mesesPagosComoAutoDebit(f: DespesaFixa, mesReferencia: YearMonth): YearMonth[] {
  if (!f.autoDebit || !f.contaCartao || !f.inicio) return [];
  const ultimo = f.fim && f.fim < mesReferencia ? f.fim : mesReferencia;
  const meses: YearMonth[] = [];
  for (let m = f.inicio; m <= ultimo; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

export interface DadosFatura {
  despesasFixas: DespesaFixa[];
  despesasFixasVeiculo: DespesaFixa[];
  despesasCorrentes: DespesaCorrente[];
  parcelas: Parcela[];
  transferencias: Transferencia[];
  /** Carregamentos e despesas variáveis do veículo pagos no cartão. */
  cargas?: CargaEletrica[];
  despesasVeiculo?: DespesaVeiculo[];
}

/** Débito automático das parcelas vinculadas ao cartão num mês do ciclo.
 *  Mês pago por FORA da fatura (`true`: pagamento manual ou quitação
 *  antecipada) sai do cálculo — cobrá-lo de novo seria dupla contagem.
 *  Mês quitado PELA fatura (`"fatura"`) continua contando, senão o devido
 *  de uma fatura já paga mudaria depois do pagamento. */
function debitoAutomaticoParcelas(cartao: string, ciclo: YearMonth, parcelas: Parcela[]): Cents {
  return parcelas.reduce((s, p) => {
    if (p.cartao !== cartao || !p.autoDebit) return s;
    if (!mesesDaParcela(p).includes(ciclo)) return s;
    if (p.pagoPorMes[ciclo] === true) return s;
    return s + valorDaParcela(p, ciclo);
  }, 0);
}

/** Valor devido automático da fatura (seção 4.1): fixas + fixas do veículo +
 *  correntes do cartão no ciclo (EXCLUINDO origem 'fat' — o pagamento da
 *  própria fatura nunca conta) + parcelas em débito automático +
 *  transferências de saída contra o cartão + cargas e despesas do veículo
 *  pagas nesse cartão no ciclo. */
export function calcularFaturaAutomatica(
  cartao: string,
  mesFatura: YearMonth,
  dados: DadosFatura,
  /** Dia de fechamento do cartão — ver `mesDoCiclo`. Sem ele, o ciclo é o mês
   *  civil inteiro (comportamento de sempre). Fixas e parcelas ficam de fora:
   *  já são bucketed por YearMonth, independente da data exata. */
  diaFechamento?: number,
): Cents {
  const ciclo = cicloDaFatura(mesFatura);
  const fixas = dados.despesasFixas
    .filter((d) => d.contaCartao === cartao && fixaAtivaNoMes(d, ciclo))
    .reduce((s, d) => s + d.valor, 0);
  const fixasVeiculo = dados.despesasFixasVeiculo
    .filter((d) => d.contaCartao === cartao && fixaAtivaNoMes(d, ciclo))
    .reduce((s, d) => s + d.valor, 0);
  const correntes = dados.despesasCorrentes
    .filter(
      (d) =>
        d.contaCartao === cartao &&
        mesDoCiclo(d.data, diaFechamento) === ciclo &&
        d.origem !== "fat",
    )
    .reduce((s, d) => s + d.valor, 0);
  const parcelas = debitoAutomaticoParcelas(cartao, ciclo, dados.parcelas);
  const transferencias = dados.transferencias
    .filter((t) => t.de === cartao && mesDoCiclo(t.data, diaFechamento) === ciclo)
    .reduce((s, t) => s + t.valor, 0);
  const cargas = (dados.cargas ?? [])
    .filter((c) => c.contaCartao === cartao && mesDoCiclo(c.data, diaFechamento) === ciclo)
    .reduce((s, c) => s + c.custo, 0);
  const veiculo = (dados.despesasVeiculo ?? [])
    .filter((d) => d.contaCartao === cartao && mesDoCiclo(d.data, diaFechamento) === ciclo)
    .reduce((s, d) => s + d.valor, 0);
  return fixas + fixasVeiculo + correntes + parcelas + transferencias + cargas + veiculo;
}

/** Formato legado do app antigo: pagamento único {paid, val, date, from, dcId}
 *  ou lista {payments: [...]}, com valores em euros float. */
interface EntradaPagamentosLegada {
  pagamentos?: PagamentoFatura[];
  payments?: { val: number; date: string; from?: string; dcId?: string | number }[];
  paid?: boolean;
  val?: number;
  date?: string;
  from?: string;
  dcId?: string | number;
}

/** Lê a lista de pagamentos de uma entrada de faturasPagas, aceitando o
 *  formato novo e os dois formatos legados (lista e pagamento único). */
export function pagamentosDaFatura(
  entrada: EntradaPagamentosLegada | undefined,
): PagamentoFatura[] {
  if (!entrada) return [];
  if (Array.isArray(entrada.pagamentos)) return entrada.pagamentos;
  if (Array.isArray(entrada.payments)) {
    return entrada.payments.map((p, i) => ({
      id: String(p.dcId ?? `legado-${i}`),
      data: p.date ?? "",
      valor: toCents(p.val ?? 0),
      de: p.from,
    }));
  }
  if (entrada.paid) {
    return [
      {
        id: String(entrada.dcId ?? "legado-0"),
        data: entrada.date ?? "",
        valor: toCents(entrada.val ?? 0),
        de: entrada.from,
      },
    ];
  }
  return [];
}

export interface ConfigFatura {
  /** Override manual por cartão/mês — prevalece sobre o automático. */
  faturaManual?: Record<string, Record<YearMonth, Cents>>;
  faturasPagas?: Record<string, Record<YearMonth, EntradaPagamentosLegada>>;
  /** Dia de fechamento por cartão — ver `mesDoCiclo`. */
  diaFechamentoFatura?: Record<string, number>;
}

/** Visão completa da fatura de um cartão num mês — sempre derivada, nunca
 *  persistida (bug 3: nada de valor congelado ambíguo). */
export function calcularFatura(
  cartao: string,
  mesFatura: YearMonth,
  dados: DadosFatura,
  cfg: ConfigFatura,
): FaturaCalculada {
  const devidoAutomatico = calcularFaturaAutomatica(
    cartao,
    mesFatura,
    dados,
    cfg.diaFechamentoFatura?.[cartao],
  );
  const overrideManual = cfg.faturaManual?.[cartao]?.[mesFatura] ?? null;
  const devido = overrideManual ?? devidoAutomatico;
  const pagamentos = pagamentosDaFatura(cfg.faturasPagas?.[cartao]?.[mesFatura]);
  const pago = pagamentos.reduce((s, p) => s + p.valor, 0);
  return {
    cartao,
    mes: mesFatura,
    devidoAutomatico,
    overrideManual,
    devido,
    pago,
    restante: Math.max(0, devido - pago),
  };
}
