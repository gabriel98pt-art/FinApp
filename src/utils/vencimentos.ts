// Compromissos que caem num dia do mês, para marcar no Calendário (item 11):
// despesas fixas, parcelas e faturas de cartão.
//
// Nem tudo tem data exata no schema — fixa e parcela têm `diaVencimento`
// (opcional), e fatura não tem dia nenhum. Daí as duas convenções abaixo:
//   - sem `diaVencimento`, o item simplesmente não é marcado (não inventamos
//     um dia que o usuário não escolheu);
//   - a fatura cai no dia 1 do mês seguinte ao ciclo, que é o mês da própria
//     fatura em `cicloDaFatura`.

import type { Cents, DespesaFixa, IsoDate, Parcela, YearMonth } from "../types";
import { fixaAtivaNoMes } from "./fatura";
import { mesesDaParcela, valorDaParcela } from "./parcelas";

export type TipoVencimento = "fixa" | "parcela" | "fatura";

export interface Vencimento {
  tipo: TipoVencimento;
  dia: IsoDate;
  titulo: string;
  detalhe?: string;
  valor: Cents;
}

/** Dia do mês limitado ao último dia real — dia 31 em fevereiro vira 28/29
 *  em vez de virar uma data inválida. */
function diaDoMes(ym: YearMonth, dia: number): IsoDate {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(dia, 1), ultimo);
  return `${ym}-${String(d).padStart(2, "0")}`;
}

/** Fixas ativas no mês que têm dia de vencimento. */
export function vencimentosDeFixas(fixas: DespesaFixa[], ym: YearMonth): Vencimento[] {
  return fixas
    .filter((f) => f.diaVencimento && fixaAtivaNoMes(f, ym))
    .map((f) => ({
      tipo: "fixa" as const,
      dia: diaDoMes(ym, f.diaVencimento!),
      titulo: f.descricao,
      detalhe: f.categoria,
      valor: f.valor,
    }));
}

/** Parcelas cujo plano inclui este mês e que têm dia de vencimento. */
export function vencimentosDeParcelas(parcelas: Parcela[], ym: YearMonth): Vencimento[] {
  return parcelas
    .filter((p) => p.diaVencimento && mesesDaParcela(p).includes(ym))
    .map((p) => {
      const meses = mesesDaParcela(p);
      return {
        tipo: "parcela" as const,
        dia: diaDoMes(ym, p.diaVencimento!),
        titulo: p.descricao,
        detalhe: `parcela ${meses.indexOf(ym) + 1}/${p.numParcelas}`,
        valor: valorDaParcela(p, ym),
      };
    });
}

/** Faturas dos cartões, no dia 1 do mês (convenção — ver nota do topo).
 *  `devidoPorCartao` já vem calculado pela tela, que é quem tem os dados
 *  todos em mãos (calcularFatura). */
export function vencimentosDeFaturas(
  devidoPorCartao: { cartao: string; devido: Cents }[],
  ym: YearMonth,
): Vencimento[] {
  return devidoPorCartao
    .filter((f) => f.devido > 0)
    .map((f) => ({
      tipo: "fatura" as const,
      dia: diaDoMes(ym, 1),
      titulo: `Fatura ${f.cartao}`,
      detalhe: "vencimento do cartão",
      valor: f.devido,
    }));
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
