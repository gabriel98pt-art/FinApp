// Operações de parcelas (seção 4.3), como updates multi-path atômicos.
// O lançamento mensal e o estado pago da parcela nunca divergem.

import { push, ref, update } from "firebase/database";
import { db } from "./firebase";
import { criarParcela as criarParcelaBase, semIndefinidos } from "./lancamentosService";
import { snapshotHistorico } from "../stores/historicoStore";
import type { Cents, DespesaCorrente, IsoDate, Parcela, YearMonth } from "../types";
import { hojeIso, mesAtual } from "../utils/calculos";
import {
  mesesDaParcela,
  mesesNaoPagos,
  valorBaseDaParcela,
  valorDaParcela,
  valorQuitacao,
} from "../utils/parcelas";

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

/** Lançamentos de despesa que espelham um mês pago da parcela — os mesmos que
 *  `pagarMesParcela` cria (e `estornarMesParcela` apaga). */
export function espelhosDoMes(p: Parcela, mes: YearMonth, despesas: DespesaCorrente[]) {
  return despesas.filter(
    (d) => d.origem === "parc" && d.parcelaId === p.id && d.parcelaMes === mes,
  );
}

/** Ajusta à mão o valor de UM mês do plano. Serve para serviços como a
 *  Klarna, que às vezes cobram parcelas desiguais (160,75 em 3× → 53,33 +
 *  53,71 + 53,71): a divisão automática nunca acerta nesses casos.
 *
 *  Mês ainda em aberto: `pagarMesParcela` lê `valorDaParcela` na hora de criar
 *  a despesa, que já usa este ajuste. Mês já pago: a despesa espelho (origem
 *  "parc", mesmo parcelaId/parcelaMes) recebe o valor novo NA MESMA escrita —
 *  parcela e lançamento nunca divergem. Mês pago sem espelho (débito
 *  automático: o valor real está na fatura do cartão) só grava o ajuste. */
export async function definirValorDoMes(
  uid: string,
  p: Parcela,
  mes: YearMonth,
  valor: Cents,
  despesas: DespesaCorrente[],
) {
  snapshotHistorico();
  const atualizacoes: Record<string, unknown> = {
    [`parcelas/${p.id}/overridePorMes/${mes}`]: valor,
  };
  espelhosDoMes(p, mes, despesas).forEach((d) => {
    atualizacoes[`despesasCorrentes/${d.id}/valor`] = valor;
  });
  await update(ref(db, raiz(uid)), atualizacoes);
}

/** Desfaz o ajuste de um mês: volta a valer a divisão automática do total. Se
 *  o mês já foi pago, a despesa espelho volta junto ao valor automático. */
export async function limparValorDoMes(
  uid: string,
  p: Parcela,
  mes: YearMonth,
  despesas: DespesaCorrente[],
) {
  snapshotHistorico();
  const atualizacoes: Record<string, unknown> = {
    [`parcelas/${p.id}/overridePorMes/${mes}`]: null,
  };
  const idx = mesesDaParcela(p).indexOf(mes);
  if (idx >= 0) {
    const automatico = valorBaseDaParcela(p, idx);
    espelhosDoMes(p, mes, despesas).forEach((d) => {
      atualizacoes[`despesasCorrentes/${d.id}/valor`] = automatico;
    });
  }
  await update(ref(db, raiz(uid)), atualizacoes);
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
 *  único lançamento de quitação. Pagamento direto — sem contaCartao.
 *
 *  O `mesReferencia` decide o que já está resolvido, e é o que impede a
 *  quitação de uma parcela em DÉBITO AUTOMÁTICO de cobrar segunda vez os meses
 *  que já saíram pela fatura do cartão: sem ele, `mesesNaoPagos` conta todos os
 *  meses sem marcação manual — e uma parcela em débito automático nunca é
 *  marcada à mão, porque o botão "Pagar mês" nem lhe aparece.
 *
 *  `hoje`, repassado a `mesesNaoPagos`/`valorQuitacao`, dá precisão de DIA ao
 *  mês de referência (ver `estaEfetivamentePaga`): sem ele, o mês corrente de
 *  uma parcela em débito automático contava como já resolvido desde o dia 1,
 *  antes de o cartão ter cobrado de facto. `LinhaParcela` (Parcelas.tsx) já
 *  calcula `abertos`/`totalQuit` COM `hoje` para mostrar ao usuário — sem
 *  passá-lo aqui também, a quitação gravava um valor menor do que o
 *  confirmado na tela e o mês corrente nunca era marcado pago, voltando a ser
 *  cobrado de novo quando a fatura daquele ciclo fosse paga. */
export async function quitarParcela(
  uid: string,
  p: Parcela,
  mesReferencia = mesAtual(),
  hoje?: IsoDate,
) {
  const abertos = mesesNaoPagos(p, mesReferencia, hoje);
  if (abertos.length === 0) return;
  snapshotHistorico();
  const total = valorQuitacao(p, mesReferencia, hoje);
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
 *  saiu — mas só continuam visíveis como despesas normais porque esta função
 *  também solta o vínculo deles com a parcela (origem/parcelaId/parcelaMes).
 *
 *  Sem isto, cada lançamento continuava com `origem: "parc"`, apontando para
 *  uma parcela que deixou de existir: `transacoesDoMes` (utils/transacoes.ts)
 *  exclui esse origem do lado da despesa de propósito, porque espera vê-lo
 *  pelo lado da parcela — e essa exclusão só faz sentido enquanto a parcela
 *  ainda está lá para renderizá-lo. `despesaRealizadaMes`/
 *  `despesasNosTotais` fazem a mesma exclusão pela mesma razão. Excluída a
 *  parcela, o lançamento ficava órfão: sumia do extrato de Transações e do
 *  total de meses já fechados, como se aquele dinheiro nunca tivesse saído —
 *  mesmo com o texto de confirmação prometendo "os meses já pagos continuam
 *  no histórico de despesas". */
export async function excluirParcela(uid: string, p: Parcela, despesas: DespesaCorrente[]) {
  snapshotHistorico();
  const atualizacoes: Record<string, unknown> = { [`parcelas/${p.id}`]: null };
  despesas
    .filter((d) => d.origem === "parc" && d.parcelaId === p.id)
    .forEach((d) => {
      atualizacoes[`despesasCorrentes/${d.id}/origem`] = null;
      atualizacoes[`despesasCorrentes/${d.id}/parcelaId`] = null;
      atualizacoes[`despesasCorrentes/${d.id}/parcelaMes`] = null;
    });
  await update(ref(db, raiz(uid)), atualizacoes);
}
