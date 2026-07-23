// Operações de fatura (seção 4.1). Cada operação é um update multi-path
// ATÔMICO no RTDB — o lançamento de pagamento, a lista de pagamentos e as
// parcelas quitadas nunca ficam fora de sincronia entre si.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import type { Cents, DespesaCorrente, PagamentoFatura, Parcela, YearMonth } from "../types";
import { hojeIso } from "../utils/calculos";
import { cicloDaFatura } from "../utils/fatura";
import { mesesDaParcela, valorDaParcela } from "../utils/parcelas";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

export interface ContextoPagamento {
  cartao: string;
  mes: YearMonth;
  /** Valor deste pagamento (parcial ou total). */
  valor: Cents;
  /** Conta/cartão de débito de onde saiu o dinheiro. */
  de: string;
  /** Pagamentos já existentes (da FaturaCalculada). */
  pagamentosAtuais: PagamentoFatura[];
  /** Devido atual — para saber se este pagamento quita a fatura. */
  devido: Cents;
  /** Todas as parcelas da conta — para quitar as autoDebit do ciclo. */
  parcelas: Parcela[];
}

/** Registra um pagamento (parcial ou total).
 *  - Cria o lançamento origem 'fat' (fora dos totais de despesa — a compra já
 *    contou; destino claro: tela Cartões).
 *  - Se o pagamento QUITA a fatura: cada parcela autoDebit do ciclo ainda não
 *    paga é marcada `"fatura"` e ganha o seu lançamento mensal origem 'parc'
 *    normal (sem contaCartao — o dinheiro saiu via fatura), para o dinheiro
 *    da parcela nunca ficar invisível nos totais (bug 2 da seção 4.1). */
export async function pagarFatura(uid: string, ctx: ContextoPagamento) {
  const hoje = hojeIso();
  const ciclo = cicloDaFatura(ctx.mes);
  const atualizacoes: Record<string, unknown> = {};

  const dcId = push(ref(db, `${raiz(uid)}/despesasCorrentes`)).key!;
  const lancamentoPagamento: Omit<DespesaCorrente, "id"> = {
    descricao: `Cartão de Crédito ${ctx.cartao}`,
    valor: ctx.valor,
    data: hoje,
    categoria: "Cartão de Crédito",
    contaCartao: ctx.de,
    origem: "fat",
    nota: `Ref. ${ctx.mes}`,
    fatCartao: ctx.cartao,
    fatMes: ctx.mes,
  };
  atualizacoes[`despesasCorrentes/${dcId}`] = semIndefinidos(lancamentoPagamento);

  const pagamentos = [
    ...ctx.pagamentosAtuais,
    semIndefinidos<PagamentoFatura>({ id: dcId, data: hoje, valor: ctx.valor, de: ctx.de }),
  ];
  atualizacoes[`cfg/faturasPagas/${ctx.cartao}/${ctx.mes}`] = { pagamentos };

  const restanteApos =
    ctx.devido - (ctx.pagamentosAtuais.reduce((s, p) => s + p.valor, 0) + ctx.valor);
  if (restanteApos <= 0) {
    for (const p of ctx.parcelas) {
      if (p.cartao !== ctx.cartao || !p.autoDebit) continue;
      if (!mesesDaParcela(p).includes(ciclo) || p.pagoPorMes[ciclo]) continue;
      atualizacoes[`parcelas/${p.id}/pagoPorMes/${ciclo}`] = "fatura";
      const idx = mesesDaParcela(p).indexOf(ciclo) + 1;
      const lancamentoParcela: Omit<DespesaCorrente, "id"> = {
        descricao: p.descricao,
        valor: valorDaParcela(p, ciclo),
        data: hoje,
        categoria: p.categoria ?? "Parcelas",
        origem: "parc",
        nota: `${idx}ª de ${p.numParcelas} — via fatura`,
        parcelaId: p.id,
        parcelaMes: ciclo,
      };
      const parcDcId = push(ref(db, `${raiz(uid)}/despesasCorrentes`)).key!;
      atualizacoes[`despesasCorrentes/${parcDcId}`] = semIndefinidos(lancamentoParcela);
    }
  }

  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Remove um pagamento (e o lançamento origem 'fat' dele). */
export async function removerPagamentoFatura(
  uid: string,
  cartao: string,
  mes: YearMonth,
  pagamento: PagamentoFatura,
  pagamentosAtuais: PagamentoFatura[],
) {
  const restantes = pagamentosAtuais.filter((p) => p.id !== pagamento.id);
  const atualizacoes: Record<string, unknown> = {
    [`despesasCorrentes/${pagamento.id}`]: null,
    [`cfg/faturasPagas/${cartao}/${mes}`]: restantes.length ? { pagamentos: restantes } : null,
  };
  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Reabre a fatura: remove todos os pagamentos e os lançamentos deles. */
export async function reabrirFatura(
  uid: string,
  cartao: string,
  mes: YearMonth,
  pagamentos: PagamentoFatura[],
) {
  const atualizacoes: Record<string, unknown> = {
    [`cfg/faturasPagas/${cartao}/${mes}`]: null,
  };
  for (const p of pagamentos) atualizacoes[`despesasCorrentes/${p.id}`] = null;
  await update(ref(db, raiz(uid)), atualizacoes);
}
