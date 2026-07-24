// Metas (seção 3, Parte C) — funções puras portadas de renderMetas()
// (financas.html ~5699-5760). Meta mensal, fundos e poupança de 12 meses.

import type { Cents, DadosVeiculo, DespesaCorrente, Fundo, Receita, YearMonth } from "../types";
import { totalDoMes } from "./calculos";
import { despesaRealizadaMes } from "./resumoMensal";

/** Fallback do app de referência: `S.cfg.sgoal || 500` — meta padrão de
 *  50000 centavos quando a conta não configurou nenhuma. */
export const META_POUPANCA_PADRAO: Cents = 50000;

export interface MetaMensal {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
  meta: Cents;
  /** 0-100, sempre dentro dos limites mesmo com saldo negativo ou acima da meta. */
  pct: number;
  atingiu: boolean;
  /** Mês diferente do real, ou último dia do mês corrente já em curso. */
  fechado: boolean;
}

/** Meta mensal: saldo do mês vs. meta configurável, com badge de status.
 *  A despesa do mês já vem de despesaRealizadaMes — que sozinha implementa a
 *  regra "mês corrente conta só o que foi realmente pago, mês fechado conta
 *  o total cheio" (seção 4.8/Parte C), então não há branch duplicado aqui. */
export function calcularMetaMensal(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  diaDeHoje: number,
  metaConfigurada: Cents,
): MetaMensal {
  const rec = totalDoMes(receitas, ym);
  const desp = despesaRealizadaMes(despesasCorrentes, veiculo, ym, mesReal);
  const saldo = rec - desp;
  const meta = metaConfigurada || META_POUPANCA_PADRAO;
  const pct = meta > 0 ? Math.max(0, Math.min(100, Math.round((saldo / meta) * 100))) : 0;

  const [ay, am] = ym.split("-").map(Number);
  const ultimoDiaDoMes = new Date(ay, am, 0).getDate();
  const isCorrente = ym === mesReal;
  const fechado = !isCorrente || diaDeHoje >= ultimoDiaDoMes;

  return { receitas: rec, despesas: desp, saldo, meta, pct, atingiu: saldo >= meta, fechado };
}

export interface TotalFundos {
  atual: Cents;
  alvo: Cents;
}

export function totalFundos(fundos: Fundo[]): TotalFundos {
  return fundos.reduce((s, f) => ({ atual: s.atual + f.atual, alvo: s.alvo + f.alvo }), {
    atual: 0,
    alvo: 0,
  });
}

/** Soma do saldo POSITIVO (nunca negativo) de cada mês da lista — "poupado
 *  nos últimos N meses". */
export function poupancaMeses(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  veiculo: DadosVeiculo,
  meses: YearMonth[],
  mesReal: YearMonth,
): Cents {
  return meses.reduce((s, ym) => {
    const rec = totalDoMes(receitas, ym);
    const desp = despesaRealizadaMes(despesasCorrentes, veiculo, ym, mesReal);
    return s + Math.max(0, rec - desp);
  }, 0);
}
