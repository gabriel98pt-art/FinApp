// Metas (seção 3, Parte C) — funções puras portadas de renderMetas()
// (financas.html ~5699-5760). Meta mensal, fundos e poupança de 12 meses.

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  Fundo,
  IsoDate,
  Parcela,
  Receita,
  YearMonth,
} from "../types";
import { receitasNosTotais, totalDoMes } from "./calculos";
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
  /** Mês PASSADO (antes do real), ou o mês corrente já no último dia. Um mês
   *  futuro não é "fechado": ainda não há veredicto a dar sobre uma meta que
   *  nem começou. */
  fechado: boolean;
}

/** Meta mensal: saldo do mês vs. meta configurável, com badge de status.
 *  A despesa do mês já vem de despesaRealizadaMes — que sozinha implementa a
 *  regra "mês corrente conta só o que foi realmente pago, mês fechado conta
 *  o total cheio" (seção 4.8/Parte C), então não há branch duplicado aqui. */
export function calcularMetaMensal(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  diaDeHoje: number,
  metaConfigurada: Cents,
  /** Mesmo `hoje` de `despesaRealizadaMes`: dá precisão de dia ao mês
   *  corrente, senão uma fixa/parcela em débito automático conta como paga
   *  antes do dia de vencimento (ver fixaEfetivamentePaga em fatura.ts). */
  hoje?: IsoDate,
): MetaMensal {
  const rec = totalDoMes(receitasNosTotais(receitas), ym);
  const desp = despesaRealizadaMes(
    despesasCorrentes,
    despesasFixas,
    parcelas,
    veiculo,
    ym,
    mesReal,
    hoje,
  );
  const saldo = rec - desp;
  const meta = metaConfigurada || META_POUPANCA_PADRAO;
  const pct = meta > 0 ? Math.max(0, Math.min(100, Math.round((saldo / meta) * 100))) : 0;

  const [ay, am] = ym.split("-").map(Number);
  const ultimoDiaDoMes = new Date(ay, am, 0).getDate();
  const isCorrente = ym === mesReal;
  // `ym` é sempre "AAAA-MM" com zero à esquerda (ver `somarMeses`/`mesDoAno`),
  // então a comparação lexicográfica vale como comparação cronológica — e é
  // o que distingue "mês passado" (fechado) de "mês futuro" (ainda não
  // começou, não fechado): comparar só com `!isCorrente` tratava os dois da
  // mesma forma, e um mês futuro sem lançamento nenhum saía com o veredicto
  // "Não atingido" antes mesmo de existir.
  const fechado = ym < mesReal || (isCorrente && diaDeHoje >= ultimoDiaDoMes);

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
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  meses: YearMonth[],
  mesReal: YearMonth,
  hoje?: IsoDate,
): Cents {
  return meses.reduce((s, ym) => {
    const rec = totalDoMes(receitasNosTotais(receitas), ym);
    const desp = despesaRealizadaMes(
      despesasCorrentes,
      despesasFixas,
      parcelas,
      veiculo,
      ym,
      mesReal,
      hoje,
    );
    return s + Math.max(0, rec - desp);
  }, 0);
}
