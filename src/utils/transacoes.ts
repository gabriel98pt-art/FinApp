// Extrato geral do mês (item 22): um feed único com tudo que movimenta
// dinheiro, vindo dos seis domínios que hoje vivem em telas separadas.
//
// Duas decisões que evitam contar a mesma coisa duas vezes:
//   - despesa corrente com origem 'parc' fica de fora: ela é o lançamento
//     gerado por uma parcela, e a parcela já entra no feed pelo seu próprio
//     item (senão a compra apareceria duplicada no mês em que foi paga);
//   - pagamento de fatura (origem 'fat') FICA: é dinheiro saindo da conta de
//     facto, e num extrato isso tem que aparecer, mesmo já tendo contado a
//     compra original no mês dela.
//
// Fixa e parcela não têm data exata: caem no `diaVencimento` quando existe,
// senão no dia 1 do mês — só pra terem um lugar na ordenação.

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
import { mesesDaParcela, valorDaParcela } from "./parcelas";

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

export function transacoesDoMes(dados: DadosTransacoes, ym: YearMonth): Transacao[] {
  const itens: Transacao[] = [];

  for (const r of dados.receitas) {
    if (mesDe(r.data) !== ym) continue;
    itens.push({
      chave: `receita-${r.id}`,
      refId: r.id,
      origem: "receita",
      data: r.data,
      titulo: r.descricao,
      categoria: r.fonte,
      conta: r.conta,
      valor: r.valor,
      entrada: true,
    });
  }

  for (const d of dados.despesasCorrentes) {
    if (mesDe(d.data) !== ym || d.origem === "parc") continue;
    itens.push({
      chave: `despesa-${d.id}`,
      refId: d.id,
      origem: "despesa",
      data: d.data,
      titulo: d.descricao,
      categoria: d.categoria,
      conta: d.contaCartao,
      valor: d.valor,
      entrada: false,
    });
  }

  // Fixas (gerais e do veículo) só entram no mês em que foram marcadas pagas.
  const todasFixas = [...dados.despesasFixas, ...dados.veiculo.despesasFixas];
  for (const f of todasFixas) {
    if (!f.pagoPorMes?.[ym]) continue;
    itens.push({
      chave: `fixa-${f.id}-${ym}`,
      refId: f.id,
      origem: "fixa",
      data: diaDoMes(ym, f.diaVencimento),
      titulo: f.descricao,
      categoria: f.categoria,
      conta: f.contaCartao,
      valor: f.valor,
      entrada: false,
    });
  }

  for (const p of dados.parcelas) {
    if (!mesesDaParcela(p).includes(ym)) continue;
    const idx = mesesDaParcela(p).indexOf(ym);
    itens.push({
      chave: `parcela-${p.id}-${ym}`,
      refId: p.id,
      origem: "parcela",
      data: diaDoMes(ym, p.diaVencimento),
      titulo: `${p.descricao} (${idx + 1}/${p.numParcelas})`,
      categoria: p.categoria ?? "Parcelas",
      conta: p.cartao ?? undefined,
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
      categoria: "Carregamento",
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
