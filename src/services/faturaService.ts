// Operações de fatura (seção 4.1). Cada operação é um update multi-path
// ATÔMICO no RTDB — o lançamento de pagamento, a lista de pagamentos e as
// parcelas quitadas nunca ficam fora de sincronia entre si.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type {
  Cents,
  DespesaCorrente,
  IsoDate,
  PagamentoFatura,
  Parcela,
  YearMonth,
} from "../types";
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
  /** Dia em que o pagamento foi mesmo feito. Omitido = hoje, como sempre foi —
   *  quem regista no próprio dia não precisa de mexer nisto. Serve para acertar
   *  pagamentos passados: sem isto, todos ficavam com a data em que foram
   *  registados, e vários acertos no mesmo dia amontoavam-se todos aí. */
  data?: IsoDate;
}

/** Registra um pagamento (parcial ou total).
 *  - Cria o lançamento origem 'fat' (fora dos totais de despesa — a compra já
 *    contou; destino claro: tela Cartões).
 *  - Se o pagamento QUITA a fatura: cada parcela autoDebit do ciclo ainda não
 *    paga é marcada `"fatura"` e ganha o seu lançamento mensal origem 'parc'
 *    normal (sem contaCartao — o dinheiro saiu via fatura), para o dinheiro
 *    da parcela nunca ficar invisível nos totais (bug 2 da seção 4.1). */
export async function pagarFatura(uid: string, ctx: ContextoPagamento) {
  snapshotHistorico();
  // A data do pagamento. As parcelas que a quitação da fatura arrasta ficam com
  // a mesma: saíram no mesmo movimento de dinheiro.
  const dataPagamento = ctx.data ?? hojeIso();
  const ciclo = cicloDaFatura(ctx.mes);
  const atualizacoes: Record<string, unknown> = {};

  const dcId = push(ref(db, `${raiz(uid)}/despesasCorrentes`)).key!;
  const lancamentoPagamento: Omit<DespesaCorrente, "id"> = {
    descricao: `Cartão de Crédito ${ctx.cartao}`,
    valor: ctx.valor,
    data: dataPagamento,
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
    semIndefinidos<PagamentoFatura>({
      id: dcId,
      data: dataPagamento,
      valor: ctx.valor,
      de: ctx.de,
    }),
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
        data: dataPagamento,
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

/** Desfaz, dentro de `atualizacoes`, a quitação que `pagarFatura` arrastou
 *  para as parcelas autoDebit do ciclo: limpa o `pagoPorMes[ciclo] === "fatura"`
 *  e apaga o lançamento espelho (origem 'parc') correspondente. Sem isto, ao
 *  remover ou reabrir um pagamento que tinha quitado a fatura, a parcela
 *  continuava marcada como paga e o lançamento dela ficava para sempre no
 *  extrato — dinheiro "voltado" para a conta que a tela de Parcelas e o
 *  extrato de Transações continuavam a dar como gasto. */
function reverterQuitacaoDeParcelas(
  cartao: string,
  mes: YearMonth,
  parcelas: Parcela[],
  despesas: DespesaCorrente[],
  atualizacoes: Record<string, unknown>,
) {
  const ciclo = cicloDaFatura(mes);
  const idsQuitadosPelaFatura = new Set(
    parcelas
      .filter((p) => p.cartao === cartao && p.pagoPorMes[ciclo] === "fatura")
      .map((p) => p.id),
  );
  for (const id of idsQuitadosPelaFatura) {
    atualizacoes[`parcelas/${id}/pagoPorMes/${ciclo}`] = null;
  }
  for (const d of despesas) {
    if (
      d.origem === "parc" &&
      d.parcelaMes === ciclo &&
      d.parcelaId &&
      idsQuitadosPelaFatura.has(d.parcelaId)
    ) {
      atualizacoes[`despesasCorrentes/${d.id}`] = null;
    }
  }
}

/** Remove um pagamento (e o lançamento origem 'fat' dele). Se, sem ele, a
 *  fatura deixa de estar quitada, desfaz também a quitação que arrastou nas
 *  parcelas autoDebit do ciclo (ver `reverterQuitacaoDeParcelas`). */
export async function removerPagamentoFatura(
  uid: string,
  cartao: string,
  mes: YearMonth,
  pagamento: PagamentoFatura,
  pagamentosAtuais: PagamentoFatura[],
  devido: Cents,
  parcelas: Parcela[],
  despesas: DespesaCorrente[],
) {
  snapshotHistorico();
  const restantes = pagamentosAtuais.filter((p) => p.id !== pagamento.id);
  const atualizacoes: Record<string, unknown> = {
    [`despesasCorrentes/${pagamento.id}`]: null,
    [`cfg/faturasPagas/${cartao}/${mes}`]: restantes.length ? { pagamentos: restantes } : null,
  };
  const aindaQuitada = restantes.reduce((s, p) => s + p.valor, 0) >= devido;
  if (!aindaQuitada) reverterQuitacaoDeParcelas(cartao, mes, parcelas, despesas, atualizacoes);
  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Reabre a fatura: remove todos os pagamentos e os lançamentos deles, e
 *  desfaz a quitação que eles arrastaram nas parcelas autoDebit do ciclo. */
export async function reabrirFatura(
  uid: string,
  cartao: string,
  mes: YearMonth,
  pagamentos: PagamentoFatura[],
  parcelas: Parcela[],
  despesas: DespesaCorrente[],
) {
  snapshotHistorico();
  const atualizacoes: Record<string, unknown> = {
    [`cfg/faturasPagas/${cartao}/${mes}`]: null,
  };
  for (const p of pagamentos) atualizacoes[`despesasCorrentes/${p.id}`] = null;
  reverterQuitacaoDeParcelas(cartao, mes, parcelas, despesas, atualizacoes);
  await update(ref(db, raiz(uid)), atualizacoes);
}
