// Operações de parcelas (seção 4.3), como updates multi-path atômicos.
// O lançamento mensal e o estado pago da parcela nunca divergem.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { criarParcela as criarParcelaBase, semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type { DespesaCorrente, Parcela, YearMonth } from "../types";
import { hojeIso } from "../utils/calculos";
import { mesesDaParcela, mesesNaoPagos, valorDaParcela, valorQuitacao } from "../utils/parcelas";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

export const criarParcela = criarParcelaBase;

/** Paga um mês da parcela: marca pago (`true` = por fora da fatura) e cria o
 *  lançamento de despesa vinculado por parcelaId/parcelaMes.
 *  Parcela autoDebit: o lançamento sai SEM contaCartao (o dinheiro sai direto,
 *  não vira compra nova no cartão — evita dupla contagem na fatura). */
export async function pagarMesParcela(uid: string, p: Parcela, mes: YearMonth) {
  snapshotHistorico();
  const idx = mesesDaParcela(p).indexOf(mes) + 1;
  const lancamento: Omit<DespesaCorrente, "id"> = {
    descricao: p.descricao,
    valor: valorDaParcela(p, mes),
    data: hojeIso(),
    categoria: p.categoria ?? "Parcelas",
    contaCartao: p.autoDebit ? undefined : (p.cartao ?? undefined),
    origem: "parc",
    nota: `${Math.max(1, idx)}ª de ${p.numParcelas}`,
    parcelaId: p.id,
    parcelaMes: mes,
  };
  const dcId = push(ref(db, `${raiz(uid)}/despesasCorrentes`)).key!;
  await update(ref(db, raiz(uid)), {
    [`despesasCorrentes/${dcId}`]: semIndefinidos(lancamento),
    [`parcelas/${p.id}/pagoPorMes/${mes}`]: true,
  });
}

/** Estorno de um mês específico: desfaz o pago e remove SÓ aquele lançamento
 *  mensal (seção 4.3). */
export async function estornarMesParcela(
  uid: string,
  p: Parcela,
  mes: YearMonth,
  despesas: DespesaCorrente[],
) {
  snapshotHistorico();
  const atualizacoes: Record<string, unknown> = {
    [`parcelas/${p.id}/pagoPorMes/${mes}`]: null,
  };
  despesas
    .filter((d) => d.origem === "parc" && d.parcelaId === p.id && d.parcelaMes === mes)
    .forEach((d) => {
      atualizacoes[`despesasCorrentes/${d.id}`] = null;
    });
  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Quitação antecipada (seção 4.3): soma as parcelas em aberto, marca todas
 *  pagas (`true` — some do débito automático de faturas futuras) e cria UM
 *  único lançamento de quitação. Pagamento direto — sem contaCartao. */
export async function quitarParcela(uid: string, p: Parcela) {
  const abertos = mesesNaoPagos(p);
  if (abertos.length === 0) return;
  snapshotHistorico();
  const total = valorQuitacao(p);
  const lancamento: Omit<DespesaCorrente, "id"> = {
    descricao: `${p.descricao} (quitação)`,
    valor: total,
    data: hojeIso(),
    categoria: p.categoria ?? "Parcelas",
    origem: "parc",
    nota: `Quitação antecipada — ${abertos.length} parcela(s)`,
    parcelaId: p.id,
    parcelaMes: "quit",
  };
  const dcId = push(ref(db, `${raiz(uid)}/despesasCorrentes`)).key!;
  const atualizacoes: Record<string, unknown> = {
    [`despesasCorrentes/${dcId}`]: semIndefinidos(lancamento),
  };
  for (const m of abertos) atualizacoes[`parcelas/${p.id}/pagoPorMes/${m}`] = true;
  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Exclui a parcela. Os lançamentos já pagos ficam — são dinheiro real que
 *  saiu e continuam visíveis como despesas normais. */
export async function excluirParcela(uid: string, p: Parcela) {
  snapshotHistorico();
  await update(ref(db, raiz(uid)), { [`parcelas/${p.id}`]: null });
}
