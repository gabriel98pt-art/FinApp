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
import { diaDoMes } from "./calculos";
import { fixaAtivaNoMes } from "./fatura";
import { diaVencimentoEfetivo, mesesDaParcela, valorDaParcela } from "./parcelas";

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
export function vencimentosDeParcelas(
  parcelas: Parcela[],
  ym: YearMonth,
  /** Dia em que a fatura de cada cartão vence — uma parcela em débito
   *  automático sai com a fatura, não em data própria. */
  diaVencimentoFatura?: Record<string, number>,
): Vencimento[] {
  return parcelas
    .filter((p) => diaVencimentoEfetivo(p, diaVencimentoFatura) && mesesDaParcela(p).includes(ym))
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
