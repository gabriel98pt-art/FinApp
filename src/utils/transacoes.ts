// Extrato geral do mês (item 22): um feed único com tudo que movimenta
// dinheiro, vindo dos seis domínios que hoje vivem em telas separadas.
//
// Três decisões sobre o que conta:
//   - despesa corrente com origem 'parc' fica de fora: ela é o lançamento
//     gerado por uma parcela, e a parcela já entra no feed pelo seu próprio
//     item (senão a compra apareceria duplicada no mês em que foi paga);
//   - pagamento de fatura (origem 'fat') FICA: é dinheiro saindo da conta de
//     facto, e num extrato isso tem que aparecer, mesmo já tendo contado a
//     compra original no mês dela;
//   - ajuste de reconciliação bancária (origem 'recon') fica de fora, dos
//     DOIS lados: não é uma transação real, é uma correção de saldo (mesma
//     regra de `despesasNosTotais`/`receitasNosTotais`, `utils/calculos.ts`).
//
// Fixa e parcela só entram no mês em que já estão resolvidas — marcadas à mão,
// ou em débito automático no cartão (fixaEfetivamentePaga/estaEfetivamentePaga
// tratam isso sem precisar de marcação nenhuma). A fixa não tem data exata:
// cai no `diaVencimento` quando existe, senão no dia 1 do mês — só pra ter um
// lugar na ordenação. A parcela usa a data do lançamento real que o pagamento
// criou, e só cai no `diaVencimento` se esse lançamento faltar.

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  Receita,
  Transferencia,
  YearMonth,
} from "../types";
import { mesDe } from "./calculos";
import { fixaEfetivamentePaga } from "./fatura";
import { estaEfetivamentePaga, mesesDaParcela, valorDaParcela } from "./parcelas";

export type OrigemTransacao =
  "receita" | "despesa" | "fixa" | "parcela" | "transferencia" | "carga" | "despesaVeiculo";

export interface Transacao {
  /** Chave única no feed (origem + id do item). */
  chave: string;
  /** Id da entidade, pra abrir a folha do tipo certo. */
  refId: string;
  origem: OrigemTransacao;
  data: IsoDate;
  titulo: string;
  /** Categoria (despesa) ou fonte (receita). */
  categoria?: string;
  conta?: string;
  /** Nota livre do item de origem — não confundir com `titulo`, que na receita
   *  e na despesa é a `descricao`. São dois campos diferentes do mesmo item. */
  nota?: string;
  valor: Cents;
  /** true = entra dinheiro (verde); false = sai (vermelho). */
  entrada: boolean;
}

export interface DadosTransacoes {
  receitas: Receita[];
  despesasCorrentes: DespesaCorrente[];
  despesasFixas: DespesaFixa[];
  parcelas: Parcela[];
  transferencias: Transferencia[];
  veiculo: DadosVeiculo;
}

function diaDoMes(ym: YearMonth, dia?: number): IsoDate {
  if (!dia) return `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${ym}-${String(Math.min(Math.max(dia, 1), ultimo)).padStart(2, "0")}`;
}

export function transacoesDoMes(
  dados: DadosTransacoes,
  ym: YearMonth,
  /** Mês de hoje. Só serve para as fixas em débito automático, que contam como
   *  pagas sem ninguém as marcar (ver `fixaEfetivamentePaga`). Opcional: sem
   *  ele, só o que está marcado à mão entra — o comportamento de sempre. */
  mesReferencia?: YearMonth,
): Transacao[] {
  const itens: Transacao[] = [];

  for (const r of dados.receitas) {
    if (mesDe(r.data) !== ym || r.origem === "recon") continue;
    itens.push({
      chave: `receita-${r.id}`,
      refId: r.id,
      origem: "receita",
      data: r.data,
      titulo: r.descricao,
      categoria: r.fonte,
      conta: r.conta,
      nota: r.nota,
      valor: r.valor,
      entrada: true,
    });
  }

  for (const d of dados.despesasCorrentes) {
    if (mesDe(d.data) !== ym || d.origem === "parc" || d.origem === "recon") continue;
    itens.push({
      chave: `despesa-${d.id}`,
      refId: d.id,
      origem: "despesa",
      data: d.data,
      titulo: d.descricao,
      categoria: d.categoria,
      conta: d.contaCartao,
      nota: d.nota,
      valor: d.valor,
      entrada: false,
    });
  }

  // Fixas (gerais e do veículo) só entram no mês em que foram pagas — marcadas
  // à mão, ou em débito automático no cartão, que não precisa de marcação.
  const todasFixas = [...dados.despesasFixas, ...dados.veiculo.despesasFixas];
  for (const f of todasFixas) {
    if (!fixaEfetivamentePaga(f, ym, mesReferencia)) continue;
    itens.push({
      chave: `fixa-${f.id}-${ym}`,
      refId: f.id,
      origem: "fixa",
      data: diaDoMes(ym, f.diaVencimento),
      titulo: f.descricao,
      categoria: f.categoria,
      conta: f.contaCartao,
      nota: f.nota,
      valor: f.valor,
      entrada: false,
    });
  }

  // Parcelas, como as fixas: só o mês já pago entra. Antes entrava qualquer mês
  // do plano — incluindo os que ainda nem chegaram — sempre com a data do
  // vencimento do cartão, um dia inventado. Uma parcela de agosto com
  // vencimento a 20 aparecia no extrato a 20/08 estando-se a 5/08.
  //
  // E a data é a do lançamento REAL que `pagarMesParcela`/`pagarFatura` criam
  // (origem 'parc'), que é quando o dinheiro saiu mesmo. Esse lançamento fica
  // fora do feed pelo seu próprio lado, para a compra não aparecer duas vezes
  // — mas a data dele é a boa. O `diaVencimento` fica só como último recurso,
  // para dados incoerentes (mês marcado pago sem lançamento nenhum).
  for (const p of dados.parcelas) {
    if (!mesesDaParcela(p).includes(ym)) continue;
    if (!estaEfetivamentePaga(p, ym, mesReferencia)) continue;
    const idx = mesesDaParcela(p).indexOf(ym);
    // "quit" é a quitação antecipada: UM lançamento que varreu vários meses de
    // uma vez. Todos eles herdam essa data — é o dia real em que se pagou,
    // ainda que não discrimine mês a mês.
    const real = dados.despesasCorrentes.find(
      (d) =>
        d.origem === "parc" &&
        d.parcelaId === p.id &&
        (d.parcelaMes === ym || d.parcelaMes === "quit"),
    );
    itens.push({
      chave: `parcela-${p.id}-${ym}`,
      refId: p.id,
      origem: "parcela",
      data: real?.data ?? diaDoMes(ym, p.diaVencimento),
      titulo: `${p.descricao} (${idx + 1}/${p.numParcelas})`,
      categoria: p.categoria ?? "Parcelas",
      conta: p.cartao ?? undefined,
      nota: p.nota,
      valor: valorDaParcela(p, ym),
      entrada: false,
    });
  }

  for (const t of dados.transferencias) {
    if (mesDe(t.data) !== ym) continue;
    itens.push({
      chave: `transferencia-${t.id}`,
      refId: t.id,
      origem: "transferencia",
      data: t.data,
      titulo: t.descricao || `${t.de} → ${t.para}`,
      categoria: "Transferência",
      conta: t.de,
      nota: t.nota,
      valor: t.valor,
      entrada: false,
    });
  }

  for (const c of dados.veiculo.cargas) {
    if (mesDe(c.data) !== ym) continue;
    itens.push({
      chave: `carga-${c.id}`,
      refId: c.id,
      origem: "carga",
      data: c.data,
      titulo: c.local,
      categoria: "Carga Elétrica",
      nota: c.nota,
      valor: c.custo,
      entrada: false,
    });
  }

  for (const d of dados.veiculo.despesas) {
    if (mesDe(d.data) !== ym) continue;
    itens.push({
      chave: `despesaVeiculo-${d.id}`,
      refId: d.id,
      origem: "despesaVeiculo",
      data: d.data,
      // A nota é o próprio título aqui (a despesa do veículo não tem descrição
      // separada) — repeti-la em `nota` mostrava-a duas vezes na mesma linha.
      titulo: d.nota || d.categoria,
      categoria: d.categoria,
      valor: d.valor,
      entrada: false,
    });
  }

  // Mais recente primeiro; empate desempata pela chave, pra ordem estável.
  return itens.sort((a, b) =>
    a.data === b.data ? a.chave.localeCompare(b.chave) : a.data < b.data ? 1 : -1,
  );
}
