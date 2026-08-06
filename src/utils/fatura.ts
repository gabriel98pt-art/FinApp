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
  PagamentoFatura,
  Parcela,
  Transferencia,
  YearMonth,
} from "../types";
import { mesDe, somarMeses } from "./calculos";
import { mesesDaParcela, valorDaParcela } from "./parcelas";
import { toCents } from "./money";

/** Ciclo coberto pela fatura de um mês: o mês civil ANTERIOR inteiro — o
 *  cartão fecha no fim do mês e cobra no seguinte (fatura de julho = gastos
 *  de junho; regra confirmada pelo dono no app de referência). Isolado aqui
 *  para um futuro ciclo configurável por cartão. */
export function cicloDaFatura(mesFatura: YearMonth): YearMonth {
  return somarMeses(mesFatura, -1);
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
 *  sempre, para quem chama sem se importar com o mês de hoje. */
export function fixaEfetivamentePaga(
  f: DespesaFixa,
  mes: YearMonth,
  mesReferencia?: YearMonth,
): boolean {
  // `pagoPorMes` pode vir indefinido: o RTDB apaga objetos vazios.
  if (f.pagoPorMes?.[mes]) return true;
  if (!mesReferencia || !f.contaCartao || !f.autoDebit || mes > mesReferencia) return false;
  // O mês tem de estar dentro do plano da fixa — quem chama nem sempre filtra
  // por isso antes (o extrato de Transações percorre todas), e sem esta linha
  // uma fixa passava a "paga" em meses anteriores ao seu início.
  return fixaAtivaNoMes(f, mes);
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
): Cents {
  const ciclo = cicloDaFatura(mesFatura);
  const fixas = dados.despesasFixas
    .filter((d) => d.contaCartao === cartao && fixaAtivaNoMes(d, ciclo))
    .reduce((s, d) => s + d.valor, 0);
  const fixasVeiculo = dados.despesasFixasVeiculo
    .filter((d) => d.contaCartao === cartao && fixaAtivaNoMes(d, ciclo))
    .reduce((s, d) => s + d.valor, 0);
  const correntes = dados.despesasCorrentes
    .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ciclo && d.origem !== "fat")
    .reduce((s, d) => s + d.valor, 0);
  const parcelas = debitoAutomaticoParcelas(cartao, ciclo, dados.parcelas);
  const transferencias = dados.transferencias
    .filter((t) => t.de === cartao && mesDe(t.data) === ciclo)
    .reduce((s, t) => s + t.valor, 0);
  const cargas = (dados.cargas ?? [])
    .filter((c) => c.contaCartao === cartao && mesDe(c.data) === ciclo)
    .reduce((s, c) => s + c.custo, 0);
  const veiculo = (dados.despesasVeiculo ?? [])
    .filter((d) => d.contaCartao === cartao && mesDe(d.data) === ciclo)
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
}

/** Visão completa da fatura de um cartão num mês — sempre derivada, nunca
 *  persistida (bug 3: nada de valor congelado ambíguo). */
export function calcularFatura(
  cartao: string,
  mesFatura: YearMonth,
  dados: DadosFatura,
  cfg: ConfigFatura,
): FaturaCalculada {
  const devidoAutomatico = calcularFaturaAutomatica(cartao, mesFatura, dados);
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
