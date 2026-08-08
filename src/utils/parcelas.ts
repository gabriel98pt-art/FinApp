// Funções puras de parcelas (seção 4.3) — comportamento portado do app de
// referência, sem dependência de Firebase/DOM.

import type { Cents, IsoDate, YearMonth } from "../types";
import type { Parcela } from "../types";
import { diaDoMes, somarMeses } from "./calculos";

/** Todos os meses do plano, do primeiro ao último. */
export function mesesDaParcela(p: Parcela): YearMonth[] {
  const meses: YearMonth[] = [];
  for (let i = 0; i < p.numParcelas; i++) meses.push(somarMeses(p.primeiroMes, i));
  return meses;
}

/** Valor-base da parcela de índice `idx` (0-based): divisão exata do total em
 *  centavos — o resto vai às primeiras parcelas (55,99 em 3× → 18,67 + 18,66
 *  + 18,66), igual ao app de referência. */
export function valorBaseDaParcela(p: Parcela, idx: number): Cents {
  const n = p.numParcelas || 1;
  const base = Math.floor(p.total / n);
  const resto = p.total - base * n;
  return base + (idx < resto ? 1 : 0);
}

/** Valor da parcela num mês: ajuste manual daquele mês, se existir; senão a
 *  divisão exata. Mês fora do plano vale 0. */
export function valorDaParcela(p: Parcela, ym: YearMonth): Cents {
  const override = p.overridePorMes?.[ym];
  if (override != null) return override;
  const idx = mesesDaParcela(p).indexOf(ym);
  if (idx < 0) return 0;
  return valorBaseDaParcela(p, idx);
}

/** Contribuição das parcelas no mês. Mesma regra das despesas fixas
 *  (contribuicaoFixasMes, utils/despesasFixas.ts):
 *  - mês CORRENTE (ym === mesReal): só conta as efetivamente pagas (marcadas
 *    à mão, ou em débito automático — `estaEfetivamentePaga` trata as duas);
 *  - qualquer outro mês (passado ou futuro): conta o valor cheio de todas as
 *    parcelas cujo plano cobre o mês, pagas ou não.
 *  É por AQUI que a parcela entra nos totais — não pelo lançamento espelho
 *  (origem 'parc'), que `despesasNosTotais` deixa de fora justamente pra não
 *  contar duas vezes. */
export function contribuicaoParcelasMes(
  parcelas: Parcela[],
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): Cents {
  const noPrazo = parcelas.filter((p) => mesesDaParcela(p).includes(ym));
  if (ym === mesReal) {
    return noPrazo
      .filter((p) => estaEfetivamentePaga(p, ym, mesReal, hoje))
      .reduce((s, p) => s + valorDaParcela(p, ym), 0);
  }
  return noPrazo.reduce((s, p) => s + valorDaParcela(p, ym), 0);
}

/** Soma de TODAS as parcelas cujo plano cobre `ym`, pagas ou não — o valor
 *  cheio do mês. Ao contrário de `contribuicaoParcelasMes`, não faz a exceção
 *  de "só pagas" no mês corrente: aqui é sempre o total, que é o que o KPI
 *  "Total do mês" da tela Parcelas mostra. */
export function totalParcelasNoMes(parcelas: Parcela[], ym: YearMonth): Cents {
  return parcelas
    .filter((p) => mesesDaParcela(p).includes(ym))
    .reduce((s, p) => s + valorDaParcela(p, ym), 0);
}

/** Do total de `ym` (ver `totalParcelasNoMes`), quanto já está resolvido —
 *  mesma regra de `estaEfetivamentePaga`, que conta também o débito automático
 *  já lançado no cartão, mesmo antes de a fatura vencer. */
export function pagoNoMes(parcelas: Parcela[], ym: YearMonth, mesReferencia: YearMonth): Cents {
  return parcelas
    .filter((p) => mesesDaParcela(p).includes(ym) && estaEfetivamentePaga(p, ym, mesReferencia))
    .reduce((s, p) => s + valorDaParcela(p, ym), 0);
}

/** Total acumulado de todos os tempos: cada parcela conta os meses já
 *  resolvidos — mesma filosofia de totalFixasGeral/totalVeiculoGeral, e o
 *  mesmo valor que os lançamentos espelho somavam antes de saírem dos totais.
 *
 *  Com `mesReferencia`, um mês em débito automático conta mesmo sem marcação
 *  manual (`estaEfetivamentePaga`) — sem ele, só o marcado à mão, como sempre
 *  contou (o plano da parcela é sempre finito, ao contrário da fixa em aberto,
 *  então aqui não há o problema de "não saber até onde recuar" que
 *  `totalFixasGeral` tem). */
export function totalParcelasGeral(parcelas: Parcela[], mesReferencia?: YearMonth): Cents {
  return parcelas.reduce(
    (s, p) =>
      s +
      mesesDaParcela(p).reduce(
        (sp, m) => (estaEfetivamentePaga(p, m, mesReferencia) ? sp + valorDaParcela(p, m) : sp),
        0,
      ),
    0,
  );
}

/** Este mês da parcela já está resolvido?
 *
 *  Marcado à mão (`true`) ou quitado pela fatura (`"fatura"`) conta sempre. E,
 *  quando a parcela é paga por CARTÃO em débito automático, conta também
 *  qualquer mês até ao de referência: a cobrança já entrou no cartão e vai ser
 *  paga quando a fatura vencer, sem o usuário ter de decidir mais nada.
 *  Esperar pela fatura para o dar por pago inchava o "falta pagar" com
 *  dinheiro que já não está em jogo.
 *
 *  Sem `mesReferencia` conta só o que está marcado — o comportamento de
 *  sempre, que é o que o Copiloto e o resto do app continuam a ver.
 *
 *  Com `hoje`, o MÊS corrente ganha precisão de DIA: uma parcela que vence dia
 *  27 não conta como paga no dia 8 só porque o mês já começou — dizer isso ao
 *  Registro Rápido e ao extrato de Transações fazia uma compra do dia 27
 *  aparecer como já feita no dia 8, com a data dela no futuro. Mês inteiramente
 *  fechado (`mes < mesReferencia`) continua a contar sem olhar o dia — não há
 *  dúvida nenhuma de que esse já passou por inteiro. Sem `hoje`, quem chama não
 *  se importa com o dia — o comportamento de sempre, o mês inteiro de uma vez. */
export function estaEfetivamentePaga(
  p: Parcela,
  mes: YearMonth,
  mesReferencia?: YearMonth,
  hoje?: IsoDate,
): boolean {
  if (p.pagoPorMes[mes]) return true;
  if (!mesReferencia || !p.cartao || !p.autoDebit || mes > mesReferencia) return false;
  if (mes < mesReferencia || !hoje) return true;
  // Sem diaVencimento não há como saber o dia certo — mais seguro esperar o
  // fim do mês (dia 31, que diaDoMes prende ao último dia real) do que supor
  // logo o dia 1, que é o padrão de diaDoMes para "sem dia nenhum".
  return diaDoMes(mes, p.diaVencimento ?? 31) <= hoje;
}

/** Dia em que a parcela vence de facto. Paga por cartão em débito automático,
 *  ela sai com a FATURA — o dia próprio deixa de valer, porque não é o usuário
 *  que escolhe quando aquilo é cobrado. Sem cartão (dinheiro, transferência),
 *  continua a valer o dia da própria parcela. */
export function diaVencimentoEfetivo(
  p: Parcela,
  diaVencimentoFatura: Record<string, number> | undefined,
): number | undefined {
  if (p.cartao && p.autoDebit) {
    const daFatura = diaVencimentoFatura?.[p.cartao];
    if (daFatura) return daFatura;
  }
  return p.diaVencimento;
}

export function mesesNaoPagos(p: Parcela, mesReferencia?: YearMonth): YearMonth[] {
  return mesesDaParcela(p).filter((m) => !estaEfetivamentePaga(p, m, mesReferencia));
}

/** Mês da próxima parcela em aberto, ou `undefined` se já está quitada. */
export function proximoMesEmAberto(p: Parcela, mesReferencia?: YearMonth): YearMonth | undefined {
  return mesesNaoPagos(p, mesReferencia)[0];
}

/** Quanto esta parcela pesa no débito do próximo mês em aberto — 0 quando já
 *  está quitada. É a contribuição de cada parcela ao KPI "Débito mensal". */
export function debitoMensalDaParcela(p: Parcela, mesReferencia?: YearMonth): Cents {
  const proximo = proximoMesEmAberto(p, mesReferencia);
  return proximo === undefined ? 0 : valorDaParcela(p, proximo);
}

/** Total da compra a guardar na Parcela, a partir do que o usuário informou.
 *  Quem sabe o valor da PARCELA dá o total por multiplicação — exato, sem
 *  resto, ao contrário do caminho normal, que divide o total em n e distribui
 *  o resto pelas primeiras (ver `valorBaseDaParcela`). */
export function totalDaCompra(
  valorInformado: Cents,
  numParcelas: number,
  modo: "total" | "parcela",
): Cents {
  return modo === "parcela" ? valorInformado * numParcelas : valorInformado;
}

/** Soma das parcelas em aberto — o valor de uma quitação antecipada. */
export function valorQuitacao(p: Parcela, mesReferencia?: YearMonth): Cents {
  return mesesNaoPagos(p, mesReferencia).reduce((s, m) => s + valorDaParcela(p, m), 0);
}

export function progressoDaParcela(
  p: Parcela,
  mesReferencia?: YearMonth,
): { pagas: number; total: number } {
  const meses = mesesDaParcela(p);
  return {
    pagas: meses.filter((m) => estaEfetivamentePaga(p, m, mesReferencia)).length,
    total: meses.length,
  };
}

export function parcelaQuitada(p: Parcela, mesReferencia?: YearMonth): boolean {
  return mesesNaoPagos(p, mesReferencia).length === 0;
}
