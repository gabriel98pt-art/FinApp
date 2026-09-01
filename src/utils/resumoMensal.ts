// "Despesa realizada do mês" combinando despesas correntes + veículo — fonte
// única usada em Início, Despesas, Metas, Resumo Anual e Copiloto, pra nunca
// divergir entre telas (seção 3 / 4.8).

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  Id,
  IsoDate,
  Parcela,
  Receita,
  YearMonth,
} from "../types";
import { despesasNosTotais, mesDe, mesesRecentes, receitasNosTotais, totalDoMes } from "./calculos";
import { contribuicaoFixasMes } from "./despesasFixas";
import { contribuicaoParcelasMes } from "./parcelas";
import { totalCargasMes, totalVeiculoMes } from "./veiculo";

export interface ResumoMesCompleto {
  receitas: Cents;
  despesas: Cents;
  saldo: Cents;
}

/** Despesa do mês = despesas correntes reais (sem pagamento de fatura, sem
 *  espelho de parcela) + despesas fixas gerais + parcelas + total do veículo
 *  (cargas + despesas + fixas — seção "Parte A").
 *
 *  Fixas, parcelas e veículo seguem todos a MESMA regra: mês corrente conta só
 *  o que foi marcado pago, mês fechado conta o valor cheio de tudo que está no
 *  prazo, pago ou não. */
export function despesaRealizadaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  /** Dia de hoje — dá precisão de dia ao mês corrente (ver `estaEfetivamentePaga`/
   *  `fixaEfetivamentePaga`): uma cobrança do dia 27 não conta como despesa
   *  realizada no dia 8. Opcional, mesmo mês inteiro de sempre sem ele. */
  hoje?: IsoDate,
): Cents {
  return (
    totalDoMes(despesasNosTotais(despesasCorrentes), ym) +
    contribuicaoFixasMes(despesasFixas, ym, mesReal, hoje) +
    contribuicaoParcelasMes(parcelas, ym, mesReal, hoje) +
    totalVeiculoMes(veiculo, ym, mesReal, hoje)
  );
}

/** "Desde sempre": mês menor que qualquer mês real, para as comparações de
 *  string ordenarem certo. Uma fixa sem `inicio` vale em QUALQUER mês, também
 *  nos anteriores ao dia em que foi criada — é assim que ela já entra no "vs
 *  mês passado" e no Resumo Anual (ver `fixaAtivaNoMes`), e a média de meses
 *  tem de concordar com o resto da tela. */
const DESDE_SEMPRE: YearMonth = "0000-01";

/** Primeiro mês em que já havia despesa de alguma espécie — o começo da
 *  história da pessoa no app, do lado do gasto.
 *
 *  Serve a `mediaDeMeses`, que precisa separar "mês em que não se gastou nada"
 *  (zero verdadeiro, entra na média) de "mês antes de a pessoa existir aqui"
 *  (ausência de dados, fica de fora). Olha as quatro fontes que
 *  `despesaRealizadaMes` soma, cada uma pela data que a faz começar: a data do
 *  lançamento nas correntes e nos registos do veículo, `inicio` nas fixas e
 *  `primeiroMes` nas parcelas.
 *
 *  `null` só quando não há despesa nenhuma em lado nenhum. */
export function primeiroMesComDespesa(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
): YearMonth | null {
  const meses: YearMonth[] = [
    ...despesasNosTotais(despesasCorrentes).map((d) => mesDe(d.data)),
    ...veiculo.cargas.map((c) => mesDe(c.data)),
    ...veiculo.despesas.map((d) => mesDe(d.data)),
    ...parcelas.map((p) => p.primeiroMes),
    ...[...despesasFixas, ...veiculo.despesasFixas].map((f) => f.inicio ?? DESDE_SEMPRE),
  ];
  return meses.length === 0 ? null : meses.reduce((min, m) => (m < min ? m : min));
}

export function resumoMesCompleto(
  receitas: Receita[],
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  parcelas: Parcela[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): ResumoMesCompleto {
  const r = totalDoMes(receitasNosTotais(receitas), ym);
  const d = despesaRealizadaMes(
    despesasCorrentes,
    despesasFixas,
    parcelas,
    veiculo,
    ym,
    mesReal,
    hoje,
  );
  return { receitas: r, despesas: d, saldo: r - d };
}

/** Uma célula da grade do Resumo Anual: o mês e se ele ainda não chegou. */
export interface CelulaJanela {
  ym: YearMonth;
  /** Mês depois de HOJE — sem despesa realizada, e fora dos totais. */
  futuro: boolean;
}

/** Os `n` meses que a grade mostra, terminando em `ate`.
 *
 *  `ate` e `mesReal` são coisas diferentes de propósito: `ate` é só onde a
 *  janela termina (o Início ancora-a no mês do seletor; Metas deixa em hoje),
 *  enquanto `mesReal` é hoje de verdade e é o único que decide o que é
 *  "futuro". Olhar um mês passado não torna os meses seguintes futuros, e
 *  olhar um mês adiante não torna passado o que ainda não aconteceu. */
export function janelaResumoAnual(n: number, ate: YearMonth, mesReal: YearMonth): CelulaJanela[] {
  return mesesRecentes(n, ate).map((ym) => ({ ym, futuro: ym > mesReal }));
}

/** Despesas fixas pagas em `ym` que ainda não têm o lançamento-espelho de
 *  data real (origem 'fixa') — dado gravado antes de 01/09/2026, quando
 *  marcar como paga só gravava `pagoPorMes`, sem lançamento nenhum.
 *
 *  Contam pelo valor cheio, no MÊS DE VENCIMENTO — mesma leitura que o app
 *  sempre deu a essas fixas, agora só isolada nesta função (que soma por
 *  data). Não é aproximação nova: é o comportamento de sempre, preservado
 *  pra quem pagou antes de o espelho existir. Uma fixa marcada paga DEPOIS
 *  desta mudança sempre tem espelho (`alternarPagoDespesaFixa`/
 *  `alternarPagoFixaVeiculo` criam-no na hora), então cai fora deste filtro e
 *  entra pela via normal, com a data real de quando saiu. */
function fixasSemEspelhoNoMes(
  fixas: DespesaFixa[],
  comEspelho: { origem?: string; fixaId?: Id; fixaMes?: YearMonth }[],
  ym: YearMonth,
): Cents {
  return fixas
    .filter((f) => f.pagoPorMes[ym] === true)
    .filter(
      (f) => !comEspelho.some((d) => d.origem === "fixa" && d.fixaId === f.id && d.fixaMes === ym),
    )
    .reduce((s, f) => s + f.valor, 0);
}

/** Despesa do mês, mas em FLUXO DE CAIXA — soma do que foi de fato
 *  registrado/pago naquele mês, pela data real de cada lançamento, e não
 *  pelo mês de vencimento do cronograma (`despesaRealizadaMes`, a função
 *  "oficial" usada em Início/Despesas/Metas/Resumo Anual/Copiloto).
 *
 *  Pedido do Gabriel (01/09/2026): pagar uma parcela ou fixa atrasada, já no
 *  mês seguinte, deve aparecer no mês em que o dinheiro saiu de verdade — não
 *  ficar preso ao mês a que a dívida se referia. Usada só no KPI "Despesas"
 *  do Início; as outras telas continuam com `despesaRealizadaMes` de
 *  propósito (é o número que os KPIs de Parcelas, Metas etc. já usam e não
 *  deve mudar de significado nelas).
 *
 *  Receita não precisa do par: `totalDoMes(receitasNosTotais(receitas), ym)`
 *  já soma por data desde sempre — não existe "receita fixa" agendada com o
 *  mesmo problema de cronograma que a despesa tem. */
export function despesaRegistradaMes(
  despesasCorrentes: DespesaCorrente[],
  despesasFixas: DespesaFixa[],
  veiculo: DadosVeiculo,
  ym: YearMonth,
): Cents {
  // 'fat' fica de fora sempre: a compra no cartão que formou a fatura já
  // teve a SUA própria data contada aqui; contar também o pagamento da
  // fatura duplicava o mesmo dinheiro. 'recon' é ajuste de saldo, não gasto.
  // 'parc' e 'fixa' ENTRAM aqui — ao contrário de `despesasNosTotais`, que os
  // exclui pra não duplicar contra o cronograma (`contribuicaoParcelasMes`/
  // `contribuicaoFixasMes`); em fluxo de caixa não existe cronograma
  // nenhum pra duplicar contra, só a data real de cada um.
  const semDuplicar = (d: { origem?: string }) => d.origem !== "fat" && d.origem !== "recon";
  const correntesRegistradas = despesasCorrentes.filter(semDuplicar);
  const veiculoDespesasRegistradas = veiculo.despesas.filter(semDuplicar);
  return (
    totalDoMes(correntesRegistradas, ym) +
    fixasSemEspelhoNoMes(despesasFixas, despesasCorrentes, ym) +
    totalCargasMes(veiculo, ym) +
    totalDoMes(veiculoDespesasRegistradas, ym) +
    fixasSemEspelhoNoMes(veiculo.despesasFixas, veiculo.despesas, ym)
  );
}
