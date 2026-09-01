// Despesa do mês repartida por categoria — dados do donut do Início.
// Portado do bloco "Donut" do financas.html (renderDashboard): fixas gerais +
// correntes do mês (sem pagamento de fatura) + parcelas pelo plano, cada uma
// na sua categoria + o veículo inteiro como UMA fatia. Fixas e parcelas só
// entram quando já realizadas — ver a nota de `despesaPorCategoriaMes`.

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
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "./fatura";
import { estaEfetivamentePaga, mesesDaParcela, valorDaParcela } from "./parcelas";
import { totalCargasMes, totalVeiculoMes } from "./veiculo";

export interface FatiaCategoria {
  categoria: string;
  valor: Cents;
  /** Percentual do total do mês, arredondado (só para exibição). */
  pct: number;
}

/** Fatias ordenadas da maior pra menor. Categorias com total zero ficam fora.
 *
 *  Tudo entra pela MESMA regra de "já realizado" que o resto do app usa (ver
 *  `transacoesDoMes` em utils/transacoes.ts e `fixaEfetivamentePaga` em
 *  utils/fatura.ts): num mês já FECHADO conta o valor cheio de tudo que estava
 *  ativo, marcado ou não; no mês CORRENTE conta só o que já foi efetivamente
 *  pago — marcado à mão, ou em débito automático com o dia de vencimento já
 *  passado. Antes as fixas gerais eram a exceção e entravam cheias mesmo
 *  pendentes: o donut inflava uma categoria com dinheiro que ainda nem tinha
 *  saído (a mensalidade que só vence dia 27 já contando no dia 18) e
 *  discordava do KPI "Despesas", do extrato de Transações e das Metas. */
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

  // Fixas gerais com a mesma regra mês corrente/mês fechado das parcelas logo
  // abaixo — em débito automático contam sem marcação nenhuma, a partir do dia
  // de vencimento (fixaEfetivamentePaga).
  for (const f of despesasFixas.filter((f) => fixaAtivaNoMes(f, ym))) {
    if (ym === mesReal && !fixaEfetivamentePaga(f, ym, mesReal, hoje)) continue;
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

/** Mesmas fatias, mas em FLUXO DE CAIXA — pela data real de cada lançamento,
 *  não pelo mês de vencimento do cronograma. Par de `despesaRegistradaMes`
 *  (utils/resumoMensal.ts), só que com o detalhe por categoria; usada só no
 *  donut do Início (item 01/09/2026), pra bater com o KPI "Despesas" da
 *  mesma tela — antes os dois usavam regras diferentes na MESMA página: o
 *  KPI já tinha virado fluxo de caixa, o donut continuava preso ao
 *  cronograma, e uma parcela paga com atraso aparecia no total mas sumia da
 *  categoria dela.
 *
 *  Mesma leitura de `despesaRegistradaMes` pras fixas sem lançamento-espelho
 *  (dado de antes de 01/09/2026): caem no mês de vencimento, sem
 *  aproximação nova. */
export function despesaPorCategoriaRegistradaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
): FatiaCategoria[] {
  const porCategoria = new Map<string, Cents>();
  const somar = (categoria: string, valor: Cents) => {
    if (valor === 0) return;
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + valor);
  };

  // 'fat'/'recon' fora, como sempre; 'parc'/'fixa'/'reemb' ENTRAM — é a data
  // real deles que decide o mês aqui, não o cronograma que os gerou.
  const semDuplicar = (d: { origem?: string }) => d.origem !== "fat" && d.origem !== "recon";
  for (const d of doMes(despesasCorrentes.filter(semDuplicar), ym)) {
    somar(d.categoria, d.valor);
  }

  // Fixas gerais pagas neste mês SEM lançamento-espelho ainda (dado antigo):
  // caem no mês de vencimento, mesmo fallback de `despesaRegistradaMes`.
  for (const f of despesasFixas.filter((f) => f.pagoPorMes[ym] === true)) {
    const temEspelho = despesasCorrentes.some(
      (d) => d.origem === "fixa" && d.fixaId === f.id && d.fixaMes === ym,
    );
    if (!temEspelho) somar(f.categoria, f.valor);
  }

  // Veículo inteiro numa fatia sintética só, como despesaPorCategoriaMes já
  // fazia — cargas contam sempre (sem estado pago/pendente); despesas e
  // fixas seguem a mesma regra de cima, com o espelho em veiculo.despesas.
  let veiculoTotal = totalCargasMes(veiculo, ym);
  for (const d of doMes(veiculo.despesas.filter(semDuplicar), ym)) {
    veiculoTotal += d.valor;
  }
  for (const f of veiculo.despesasFixas.filter((f) => f.pagoPorMes[ym] === true)) {
    const temEspelho = veiculo.despesas.some(
      (d) => d.origem === "fixa" && d.fixaId === f.id && d.fixaMes === ym,
    );
    if (!temEspelho) veiculoTotal += f.valor;
  }
  somar("Veículo", veiculoTotal);

  const fatias = [...porCategoria.entries()]
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
 *  última fecha em 100% mesmo com resto de arredondamento.
 *
 *  `gapPct`, se passado, abre um respiro fino em CADA fronteira entre fatias
 *  — inclusive a que fecha o círculo entre a última e a primeira — pintado
 *  com `corSeparador`. Sem isso, duas categorias com cores parecidas viravam
 *  uma fatia visualmente só (achado da auditoria de Design). `0` (padrão)
 *  preserva o comportamento de sempre: fatias coladas, uma parada por fatia.
 *  Fatia mais fina que o próprio gap não ganha separador — melhor ficar
 *  inteira do que inverter a faixa (start > end quebra o conic-gradient). */
export function paradasDonut(
  fatias: FatiaCategoria[],
  cores: string[],
  gapPct = 0,
  corSeparador = "var(--s1)",
): string[] {
  const total = totalDasFatias(fatias);
  if (total <= 0) return [];

  let acumulado = 0;
  const cortes = fatias.map((f, i) => {
    const inicio = acumulado;
    acumulado += (f.valor / total) * 100;
    const fim = i === fatias.length - 1 ? 100 : acumulado;
    return { inicio, fim };
  });

  if (fatias.length < 2 || gapPct <= 0) {
    return cortes.map((c, i) => `${cores[i]} ${c.inicio.toFixed(3)}% ${c.fim.toFixed(3)}%`);
  }

  // Bordas reais de cada fatia (encolhidas pro respiro, exceto a que for fina
  // demais pra caber os dois lados). Numa lista à parte porque a fronteira
  // "última ↔ primeira" (o círculo fecha) precisa ver a fatia 0 antes de
  // decidir a própria borda final.
  const metadeGap = gapPct / 2;
  const reais = cortes.map((c) => {
    const encolhida = c.fim - c.inicio > gapPct;
    return {
      inicio: encolhida ? c.inicio + metadeGap : c.inicio,
      fim: encolhida ? c.fim - metadeGap : c.fim,
    };
  });

  const paradas: string[] = [];
  // Metade do respiro que fecha o círculo (100% ↔ 0%) fica no INÍCIO da
  // lista — um conic-gradient só anda pra frente, não pode "voltar" a 0%
  // depois de chegar em 100%.
  if (reais[0].inicio > 0) {
    paradas.push(`${corSeparador} 0.000% ${reais[0].inicio.toFixed(3)}%`);
  }
  reais.forEach((r, i) => {
    paradas.push(`${cores[i]} ${r.inicio.toFixed(3)}% ${r.fim.toFixed(3)}%`);
    const proximaInicio = i === reais.length - 1 ? 100 : reais[i + 1].inicio;
    if (proximaInicio > r.fim) {
      paradas.push(`${corSeparador} ${r.fim.toFixed(3)}% ${proximaInicio.toFixed(3)}%`);
    }
  });
  return paradas;
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
