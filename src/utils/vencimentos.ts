// Compromissos que caem num dia do mês, para marcar no Calendário (item 11):
// despesas fixas, parcelas e faturas de cartão.
//
// Nem tudo tem data exata garantida — fixa e parcela têm `diaVencimento`
// (opcional), e fatura tem `cfg.diaVencimentoFatura[cartao]` (também
// opcional, configurado em Cartões). Duas convenções abaixo:
//   - sem `diaVencimento`, o item simplesmente não é marcado (não inventamos
//     um dia que o usuário não escolheu);
//   - fatura SEM `diaVencimentoFatura` configurado cai no dia 1 do mês da
//     própria fatura (`cicloDaFatura`) — aqui sim é preciso mostrar algo,
//     mesmo sem dia exato, porque a fatura em si não é opcional de marcar
//     como as outras duas. COM o dia configurado, é ele que vale — era isto
//     que faltava: a função nunca olhava para `diaVencimentoFatura`, então
//     toda fatura caía no dia 1 mesmo quem já tinha configurado o dia real
//     (ex. dia 20) em Cartões.

import type { Cents, DespesaFixa, IsoDate, Parcela, YearMonth } from "../types";
import { diaDoMes } from "./calculos";
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "./fatura";
import {
  diaVencimentoEfetivo,
  estaEfetivamentePaga,
  mesesDaParcela,
  valorDaParcela,
} from "./parcelas";

// `diaDoMes` mora em utils/calculos.ts (módulo sem dependências), pra dar pra
// usar também de utils/parcelas.ts e utils/fatura.ts sem import circular —
// mas continua exportado daqui, que é de onde a importação e as notificações
// já o importam.
export { diaDoMes };

export type TipoVencimento = "fixa" | "parcela" | "fatura";

export interface Vencimento {
  tipo: TipoVencimento;
  dia: IsoDate;
  titulo: string;
  detalhe?: string;
  valor: Cents;
}

/** Fixas ativas no mês que têm dia de vencimento e AINDA NÃO estão pagas —
 *  um compromisso resolvido não é mais um "vencimento" a lembrar. Mesma
 *  função (`fixaEfetivamentePaga`) que Transações e o Orçamento já usam, pra
 *  não voltar a acontecer o que aconteceu em ef9fa9b: cada tela com a sua
 *  própria ideia de "já pago" faz o app discordar consigo mesmo.
 *
 *  `mesReferencia`/`hoje` são opcionais e sem eles nada mostra como pago (o
 *  comportamento de sempre) — só passe quando tiver os dois, ou uma fixa em
 *  débito automático nunca marcada à mão continua a aparecer todo mês. */
export function vencimentosDeFixas(
  fixas: DespesaFixa[],
  ym: YearMonth,
  mesReferencia?: YearMonth,
  hoje?: IsoDate,
): Vencimento[] {
  return fixas
    .filter(
      (f) =>
        f.diaVencimento &&
        fixaAtivaNoMes(f, ym) &&
        !fixaEfetivamentePaga(f, ym, mesReferencia, hoje),
    )
    .map((f) => ({
      tipo: "fixa" as const,
      dia: diaDoMes(ym, f.diaVencimento!),
      titulo: f.descricao,
      detalhe: f.categoria,
      valor: f.valor,
    }));
}

/** Parcelas cujo plano inclui este mês, que têm dia de vencimento e cujo mês
 *  AINDA NÃO está pago — mesma razão de `vencimentosDeFixas`: um mês já
 *  quitado não é mais um vencimento. Sem `mesReferencia`/`hoje`, nada conta
 *  como pago automaticamente (só o marcado à mão) — o comportamento de
 *  sempre, igual ao resto do app quando chamado sem os dois. */
export function vencimentosDeParcelas(
  parcelas: Parcela[],
  ym: YearMonth,
  /** Dia em que a fatura de cada cartão vence — uma parcela em débito
   *  automático sai com a fatura, não em data própria. */
  diaVencimentoFatura?: Record<string, number>,
  mesReferencia?: YearMonth,
  hoje?: IsoDate,
): Vencimento[] {
  return parcelas
    .filter(
      (p) =>
        diaVencimentoEfetivo(p, diaVencimentoFatura) &&
        mesesDaParcela(p).includes(ym) &&
        !estaEfetivamentePaga(p, ym, mesReferencia, hoje),
    )
    .map((p) => {
      const meses = mesesDaParcela(p);
      return {
        tipo: "parcela" as const,
        dia: diaDoMes(ym, diaVencimentoEfetivo(p, diaVencimentoFatura)!),
        titulo: p.descricao,
        detalhe: `parcela ${meses.indexOf(ym) + 1}/${p.numParcelas}`,
        valor: valorDaParcela(p, ym),
      };
    });
}

/** Faturas dos cartões, no dia real de vencimento de cada uma (ver nota do
 *  topo). `restantePorCartao` já vem calculado pela tela, que é quem tem os
 *  dados todos em mãos (calcularFatura).
 *
 *  Usa `restante` (devido − pago), não `devido`: uma fatura já paga (mesmo
 *  parcialmente, até restar zero) continuava a aparecer como vencimento
 *  inteiro, porque `devido` é o total bruto do ciclo e não desconta
 *  pagamentos — mesma família do bug de fixa/parcela acima. */
export function vencimentosDeFaturas(
  restantePorCartao: { cartao: string; restante: Cents; nome?: string }[],
  ym: YearMonth,
  diaVencimentoFatura?: Record<string, number>,
): Vencimento[] {
  return restantePorCartao
    .filter((f) => f.restante > 0)
    .map((f) => ({
      tipo: "fatura" as const,
      dia: diaDoMes(ym, diaVencimentoFatura?.[f.cartao] ?? 1),
      // `cartao` é o id, que nunca muda; `nome` é como o cartão se chama hoje.
      // Sem ele, um cartão renomeado aparecia no calendário com o nome antigo.
      titulo: `Fatura ${f.nome ?? f.cartao}`,
      detalhe: "vencimento do cartão",
      valor: f.restante,
    }));
}

/** Quanto dinheiro está em jogo — a soma dos vencimentos passados.
 *
 *  É o que os KPIs do Calendário mostram: contar compromissos ("3 vencimentos")
 *  não diz se o mês aperta ou não, e a própria grelha já marca em que dias há
 *  alguma coisa. O valor em euros é a informação que só o cartão dá. */
export function totalAVencer(vencimentos: Vencimento[]): Cents {
  return vencimentos.reduce((s, v) => s + v.valor, 0);
}

/** Os vencimentos que caem entre `de` e `ate`, ambos incluídos — datas ISO
 *  comparam-se como texto, sem Date/timezone (mesma convenção do resto). */
export function naJanela(vencimentos: Vencimento[], de: IsoDate, ate: IsoDate): Vencimento[] {
  return vencimentos.filter((v) => v.dia >= de && v.dia <= ate);
}

/** Agrupa por dia, pro grid do Calendário. */
export function porDia(vencimentos: Vencimento[]): Map<IsoDate, Vencimento[]> {
  const mapa = new Map<IsoDate, Vencimento[]>();
  for (const v of vencimentos) {
    const lista = mapa.get(v.dia);
    if (lista) lista.push(v);
    else mapa.set(v.dia, [v]);
  }
  return mapa;
}
