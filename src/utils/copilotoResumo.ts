// O que sai da app em direção à camada 2 (IA) — e, tão importante quanto, o
// que NÃO sai.
//
// Vai o agregado: totais do mês, quebra por categoria, fundos com prazo e um
// punhado de números derivados já calculados (média diária, projeção, mês
// anterior, categorias acima do costume).
//
// Vão também lançamentos crus, mas com limite deliberado: SÓ as
// `MAX_TRANSACOES_RECENTES` despesas mais recentes do MÊS CORRENTE, e de cada
// uma só data curta, categoria, descrição e valor. Nunca o histórico completo,
// nunca outros meses, nunca `contaCartao` nem `id`. A troca foi feita de olhos
// abertos: sem nenhum lançamento, perguntas do tipo "qual foi a minha última
// compra em X" não tinham resposta possível — a camada 1 não bate padrão e a
// camada 2 não tinha o dado. Uma janela curta do mês em curso responde a isso
// sem exportar a vida financeira toda para fora da app.
//
// Quem quiser saber o que foi enviado lê este ficheiro inteiro em dois
// minutos, e é para continuar assim.
//
// Os valores vão FORMATADOS ("€ 1.248,16") e não em centavos, de propósito: a
// IA não tem de fazer aritmética nenhuma, só citar o número que já lhe foi
// dado. Mandar 124816 seria convidá-la a dividir por 100 e a errar. Pela mesma
// razão as percentagens vão como "+12%" e não como 12: a regra do prompt é
// "nunca faças contas", por isso tudo o que houvesse a calcular é calculado
// aqui.

import type { ContextoCopiloto } from "./copiloto";
import {
  categoriasAcimaDaMedia,
  categoriasDoMes,
  dataCurta,
  projecaoFimMes,
  totaisDoMes,
} from "./copiloto";
import { formatMoney } from "./money";
import { rotuloMes, rotuloVariacao, somarMeses, variacaoMensal } from "./calculos";

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

/** Uma despesa recente do mês corrente. Sem conta/cartão e sem id — o que a
 *  pergunta "o que comprei" precisa é o quê, quando e quanto. */
export interface TransacaoResumo {
  /** 'DD/MM' — o ano é sempre o do mês corrente. */
  data: string;
  categoria: string;
  descricao: string;
  valor: string;
}

export interface ComparacaoMesResumo {
  mes: string;
  receitas: string;
  despesas: string;
  /** Variação do mês corrente face ao anterior, já com sinal ('+12%').
   *  `null` quando o mês anterior não serve de base (zero ou negativo). */
  variacaoReceitas: string | null;
  variacaoDespesas: string | null;
}

export interface TendenciaResumo {
  categoria: string;
  /** Quanto está acima da média dos meses fechados, já com sinal ('+34%'). */
  desvioPct: string;
  /** Quantos meses fechados entraram na média — sem isto não se sabe se é
   *  tendência ou um mês só a fingir de tendência. */
  mesesUsados: number;
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
  /** As mais recentes do mês corrente, das novas para as antigas. */
  ultimasTransacoes: TransacaoResumo[];
  /** Despesa do mês a dividir pelos dias já corridos. */
  mediaDiaria: string;
  /** Saldo esperado no fim do mês, mantendo este ritmo. `null` quando não há
   *  dia de hoje válido para projetar. */
  projecaoFimMes: string | null;
  comparacaoMesAnterior: ComparacaoMesResumo;
  /** Até `MAX_TENDENCIAS` categorias acima do costume. */
  tendencias: TendenciaResumo[];
}

/** Quantas categorias seguem para a IA. As maiores bastam: a cauda de valores
 *  minúsculos não muda conselho nenhum e só aumenta o que sai da app. */
const MAX_CATEGORIAS = 8;

/** Quantas despesas recentes seguem para a IA. Oito chega para "a última
 *  compra em X" sem transformar o resumo num extrato. */
const MAX_TRANSACOES_RECENTES = 8;

/** Três categorias acima do costume já são um diagnóstico; mais do que isso é
 *  uma lista que ninguém lê. */
const MAX_TENDENCIAS = 3;

export function montarResumoParaIA(ctx: ContextoCopiloto): ResumoParaIA {
  // Mesma âncora da camada 1 (ver `mesVisivel` em ContextoCopiloto): o resumo
  // que vai para a IA tem de falar do mês que a pessoa está a ver, senão a
  // camada 2 respondia sobre agosto com julho escolhido no ecrã — o mesmo bug
  // já corrigido na camada 1, só que esquecido aqui.
  const ym = ctx.mesVisivel ?? ctx.mesReal;
  const moeda = ctx.cfg.currency;
  const t = totaisDoMes(ctx, ym);
  const cats = categoriasDoMes(ctx, ym);

  const anterior = somarMeses(ym, -1);
  const tAnterior = totaisDoMes(ctx, anterior);
  const varReceitas = variacaoMensal(t.receitas, tAnterior.receitas);
  const varDespesas = variacaoMensal(t.despesas, tAnterior.despesas);

  const projecao = projecaoFimMes(ctx, ym);

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
    ultimasTransacoes: ctx.despesas
      .filter((d) => d.data.slice(0, 7) === ym)
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, MAX_TRANSACOES_RECENTES)
      .map((d) => ({
        data: dataCurta(d.data),
        categoria: d.categoria,
        descricao: d.descricao,
        valor: formatMoney(d.valor, moeda),
      })),
    // Divisão protegida: um dia de hoje inválido daria Infinity, e "gasta
    // € Infinity por dia" não é resposta nenhuma. E só faz sentido para o mês
    // REAL — dividir a despesa de um mês visível já fechado pelo dia de hoje
    // misturaria dois meses diferentes numa "média" que não é de nada.
    mediaDiaria: formatMoney(
      ym === ctx.mesReal && ctx.diaDeHoje > 0 ? Math.round(t.despesas / ctx.diaDeHoje) : 0,
      moeda,
    ),
    projecaoFimMes: projecao === null ? null : formatMoney(projecao, moeda),
    comparacaoMesAnterior: {
      mes: rotuloMes(anterior),
      receitas: formatMoney(tAnterior.receitas, moeda),
      despesas: formatMoney(tAnterior.despesas, moeda),
      variacaoReceitas: varReceitas === null ? null : rotuloVariacao(varReceitas),
      variacaoDespesas: varDespesas === null ? null : rotuloVariacao(varDespesas),
    },
    tendencias: categoriasAcimaDaMedia(ctx, ym)
      .slice(0, MAX_TENDENCIAS)
      .map((m) => ({
        categoria: m.categoria,
        // desvioPct nunca é null aqui: categoriasAcimaDaMedia já filtra por ele.
        desvioPct: rotuloVariacao(m.desvioPct ?? 0),
        mesesUsados: m.mesesUsados,
      })),
  };
}
