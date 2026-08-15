// O que sai da app em direção à camada 2 (IA) — e, tão importante quanto, o
// que NÃO sai.
//
// Vai só o agregado: totais do mês, quebra por categoria e fundos com prazo.
// Nunca lançamentos crus — nem descrição, nem data, nem estabelecimento, nem
// cartão. Quem quiser saber o que foi enviado lê este ficheiro inteiro em dois
// minutos, e é para continuar assim.
//
// Os valores vão FORMATADOS ("€ 1.248,16") e não em centavos, de propósito: a
// IA não tem de fazer aritmética nenhuma, só citar o número que já lhe foi
// dado. Mandar 124816 seria convidá-la a dividir por 100 e a errar.

import type { ContextoCopiloto } from "./copiloto";
import { categoriasDoMes, totaisDoMes } from "./copiloto";
import { formatMoney } from "./money";
import { rotuloMes } from "./calculos";

export interface CategoriaResumo {
  nome: string;
  total: string;
}

export interface FundoResumo {
  nome: string;
  alvo: string;
  atual: string;
  prazo: string;
}

/** Retrato agregado da conta, em texto já formatado. */
export interface ResumoParaIA {
  mes: string;
  receitas: string;
  despesas: string;
  saldo: string;
  categorias: CategoriaResumo[];
  /** Só os que têm prazo — sem prazo não há nada a planear no tempo. */
  fundos: FundoResumo[];
}

/** Quantas categorias seguem para a IA. As maiores bastam: a cauda de valores
 *  minúsculos não muda conselho nenhum e só aumenta o que sai da app. */
const MAX_CATEGORIAS = 8;

export function montarResumoParaIA(ctx: ContextoCopiloto): ResumoParaIA {
  const ym = ctx.mesReal;
  const moeda = ctx.cfg.currency;
  const t = totaisDoMes(ctx, ym);
  const cats = categoriasDoMes(ctx, ym);

  return {
    mes: rotuloMes(ym),
    receitas: formatMoney(t.receitas, moeda),
    despesas: formatMoney(t.despesas, moeda),
    saldo: formatMoney(t.receitas - t.despesas, moeda),
    categorias: Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIAS)
      .map(([nome, total]) => ({ nome, total: formatMoney(total, moeda) })),
    fundos: ctx.fundos
      .filter((f) => f.prazo)
      .map((f) => ({
        nome: f.nome,
        alvo: formatMoney(f.alvo, moeda),
        atual: formatMoney(f.atual, moeda),
        prazo: f.prazo!,
      })),
  };
}
