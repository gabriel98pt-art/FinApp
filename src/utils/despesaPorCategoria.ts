// Despesa do mês repartida por categoria — dados do donut do Início.
// Portado do bloco "Donut" do financas.html (renderDashboard): fixas gerais
// ativas + correntes do mês (sem pagamento de fatura) + parcelas pelo plano,
// cada uma na sua categoria + o veículo inteiro como UMA fatia.

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  Parcela,
  YearMonth,
} from "../types";
import { despesasNosTotais, doMes } from "./calculos";
import { fixaAtivaNoMes } from "./fatura";
import { mesesDaParcela, valorDaParcela } from "./parcelas";
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
  // `despesasNosTotais` já tirou), com a mesma regra mês corrente/mês fechado.
  for (const p of parcelas.filter((p) => mesesDaParcela(p).includes(ym))) {
    if (ym === mesReal && !p.pagoPorMes[ym]) continue;
    somar(p.categoria ?? "Parcelas", valorDaParcela(p, ym));
  }
  somar("Veículo", totalVeiculoMes(veiculo, ym, mesReal));

  const fatias = [...porCategoria.entries()]
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
 *  `coresCategoria.ts` já trata como a mesma coisa. */
const FAMILIA_ALUGUEL = ["casa", "habitacao", "renda", "aluguer"];

/** Sem acento e em minúsculas, para comparar nomes escritos de várias formas. */
function normalizar(nome: string): string {
  return nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
