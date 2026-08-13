// Despesa do mês repartida por categoria — dados do donut do Início.
// Portado do bloco "Donut" do financas.html (renderDashboard): fixas gerais
// ativas + correntes do mês (sem pagamento de fatura) + parcelas pelo plano,
// cada uma na sua categoria + o veículo inteiro como UMA fatia.

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  YearMonth,
} from "../types";
import { despesasNosTotais, doMes } from "./calculos";
import { fixaAtivaNoMes } from "./fatura";
import { estaEfetivamentePaga, mesesDaParcela, valorDaParcela } from "./parcelas";
import { totalVeiculoMes } from "./veiculo";

export interface FatiaCategoria {
  categoria: string;
  valor: Cents;
  /** Percentual do total do mês, arredondado (só para exibição). */
  pct: number;
}

/** Fatias ordenadas da maior pra menor. Categorias com total zero ficam fora.
 *  Atenção (mesma regra do app de referência): as fixas contam pelo valor
 *  cheio de todas as ativas no mês, sem olhar pago/pendente — o donut mostra o
 *  compromisso do mês, enquanto o KPI "Despesas" conta só o realizado. */
export function despesaPorCategoriaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  /** Dia de hoje — mesma precisão de DIA do resto do app (ver a nota igual em
   *  `statusOrcamentoMes`). Sem ele o donut inflava a categoria de uma parcela
   *  em débito automático desde o dia 1 do mês, antes de o dinheiro sair.
   *  Opcional: sem `hoje`, mês inteiro de uma vez, como sempre foi. */
  hoje?: IsoDate,
): FatiaCategoria[] {
  const porCategoria = new Map<string, Cents>();
  const somar = (categoria: string, valor: Cents) => {
    if (valor === 0) return;
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + valor);
  };

  for (const f of despesasFixas.filter((f) => fixaAtivaNoMes(f, ym))) {
    somar(f.categoria, f.valor);
  }
  for (const d of doMes(despesasNosTotais(despesasCorrentes), ym)) {
    somar(d.categoria, d.valor);
  }
  // Parcelas entram pelo plano (não pelo lançamento espelho, que
  // `despesasNosTotais` já tirou), com a mesma regra mês corrente/mês fechado
  // — e em débito automático conta mesmo sem marcação (estaEfetivamentePaga).
  for (const p of parcelas.filter((p) => mesesDaParcela(p).includes(ym))) {
    if (ym === mesReal && !estaEfetivamentePaga(p, ym, mesReal, hoje)) continue;
    somar(p.categoria ?? "Parcelas", valorDaParcela(p, ym));
  }
  // O `hoje` vai também para o veículo: as fixas dele seguem a mesma regra de
  // dia (`contribuicaoFixasVeiculoMes`), e `despesaRealizadaMes` já lho passava.
  // Sem isto ficava metade da correção — a fatia "Veículo" continuava a inchar
  // no dia 1 por uma fixa que só vence no fim do mês.
  somar("Veículo", totalVeiculoMes(veiculo, ym, mesReal, hoje));

  const fatias = [...porCategoria.entries()]
    // Fora as que não sobraram. O `somar` acima já ignorava uma entrada de
    // valor zero, mas não o TOTAL da categoria acabar em zero ou abaixo, que é
    // o que acontece quando um reembolso cobre a despesa toda (jantar em grupo
    // devolvido por inteiro) ou a ultrapassa (estorno com juros). Uma fatia de
    // 0% não desenha nada e uma negativa desenha ao contrário: em ambos os
    // casos entra lixo na legenda e o total do donut deixa de bater com a
    // soma das fatias visíveis.
    .filter(([, valor]) => valor > 0)
    .map(([categoria, valor]) => ({ categoria, valor, pct: 0 }))
    .sort((a, b) => b.valor - a.valor);

  const total = fatias.reduce((s, f) => s + f.valor, 0);
  return fatias.map((f) => ({ ...f, pct: total > 0 ? Math.round((f.valor / total) * 100) : 0 }));
}

/** Total das fatias — o "100%" do donut. */
export function totalDasFatias(fatias: FatiaCategoria[]): Cents {
  return fatias.reduce((s, f) => s + f.valor, 0);
}

/** Paradas do `conic-gradient` do donut, em % acumulado — calculadas dos
 *  valores exatos, não do `pct` arredondado, pra não sobrar/faltar fatia. A
 *  última fecha em 100% mesmo com resto de arredondamento. */
export function paradasDonut(fatias: FatiaCategoria[], cores: string[]): string[] {
  const total = totalDasFatias(fatias);
  if (total <= 0) return [];
  let acumulado = 0;
  return fatias.map((f, i) => {
    const inicio = acumulado;
    acumulado += (f.valor / total) * 100;
    const fim = i === fatias.length - 1 ? 100 : acumulado;
    return `${cores[i]} ${inicio.toFixed(3)}% ${fim.toFixed(3)}%`;
  });
}

/** Nomes que valem como "aluguel" — os mesmos sinónimos que
 *  `coresCategoria.ts` já trata como a mesma coisa, mais a grafia pt-BR
 *  ("aluguel"), que faltava aqui e por isso não era excluída. */
const FAMILIA_ALUGUEL = ["casa", "habitacao", "renda", "aluguer", "aluguel"];

/** Sem acento e em minúsculas, para comparar nomes escritos de várias formas. */
function normalizar(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** A maior fatia do mês IGNORANDO o veículo e a família "aluguel": são as duas
 *  maiores por natureza quase todo mês, e saber isso não diz nada de novo. O
 *  card quer a maior entre as que variam. `null` quando não sobra nenhuma. */
export function maiorCategoriaRelevante(fatias: FatiaCategoria[]): FatiaCategoria | null {
  const elegiveis = fatias.filter(
    (f) => f.categoria !== "Veículo" && !FAMILIA_ALUGUEL.includes(normalizar(f.categoria)),
  );
  // já vêm ordenadas da maior pra menor
  return elegiveis[0] ?? null;
}
