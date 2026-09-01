// Totais do veículo (seção 3, Parte A) — funções puras em centavos.
// Portado do financas.html: totVeh(ym) = cargas + despesas variáveis + fixas
// ativas do veículo, somado dentro do total geral de despesas do app.

import type {
  Abastecimento,
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  IsoDate,
  YearMonth,
} from "../types";
import { doMes, mesDe, totalDoMes } from "./calculos";
import { fixaAtivaNoMes, fixaEfetivamentePaga, mesesPagosComoAutoDebit } from "./fatura";

export function totalCargasMes(veiculo: DadosVeiculo, ym: YearMonth): Cents {
  return veiculo.cargas.filter((c) => mesDe(c.data) === ym).reduce((s, c) => s + c.custo, 0);
}

export function totalDespesasVeiculoMes(veiculo: DadosVeiculo, ym: YearMonth): Cents {
  return totalDoMes(veiculo.despesas, ym);
}

/** Contribuição das despesas fixas do veículo no mês. Mesma regra do app de
 *  referência (renderMetas/totDespRealized), aplicada só a este domínio —
 *  despesas correntes e parcelas do FinApp já só entram nos totais quando
 *  realmente pagas (estabelecido no Marco 3), então não têm o problema de
 *  "obrigação ainda não paga inflando o mês corrente" que a fixa tem:
 *  - mês CORRENTE (ym === mesReal): só conta as marcadas pagas naquele mês;
 *  - qualquer outro mês (passado ou futuro): conta o valor cheio de todas as
 *    ativas, igual ao "totDesp" do app de referência pra meses fechados. */
export function contribuicaoFixasVeiculoMes(
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): Cents {
  const ativas = veiculo.despesasFixas.filter((f) => fixaAtivaNoMes(f, ym));
  if (ym === mesReal) {
    return ativas
      .filter((f) => fixaEfetivamentePaga(f, ym, mesReal, hoje))
      .reduce((s, f) => s + f.valor, 0);
  }
  return ativas.reduce((s, f) => s + f.valor, 0);
}

/** Total do veículo no mês — cargas + despesas variáveis + fixas (seção 3). */
export function totalVeiculoMes(
  veiculo: DadosVeiculo,
  ym: YearMonth,
  mesReal: YearMonth,
  hoje?: IsoDate,
): Cents {
  return (
    totalCargasMes(veiculo, ym) +
    totalDespesasVeiculoMes(veiculo, ym) +
    contribuicaoFixasVeiculoMes(veiculo, ym, mesReal, hoje)
  );
}

/** Total acumulado de todos os tempos (para KPIs "geral"/"poupança"): cargas
 *  e despesas contam sempre (sempre realizadas); cada fixa conta o valor ×
 *  quantos meses já saíram — mesma filosofia "só o que foi realmente pago"
 *  aplicada ao histórico inteiro, não só ao mês corrente.
 *
 *  Mesmo tratamento de `totalFixasGeral` (utils/despesasFixas.ts): com
 *  `mesReferencia`, os meses em débito automático contam mesmo sem marcação
 *  manual, sem contar duas vezes um mês que esteja também marcado à mão. Sem
 *  `mesReferencia`, só o marcado, como sempre contou.
 *
 *  Com `hoje`, o mês de `mesReferencia` ganha precisão de DIA, mesma razão de
 *  `totalFixasGeral`: sem isto, uma fixa do veículo em débito automático que
 *  vence dia 27 já contava o mês inteiro saído no dia 1. */
export function totalVeiculoGeral(
  veiculo: DadosVeiculo,
  mesReferencia?: YearMonth,
  hoje?: IsoDate,
): Cents {
  const cargas = veiculo.cargas.reduce((s, c) => s + c.custo, 0);
  const despesas = veiculo.despesas.reduce((s, d) => s + d.valor, 0);
  const fixas = veiculo.despesasFixas.reduce((s, f) => {
    const marcados = Object.entries(f.pagoPorMes ?? {})
      .filter(([, pago]) => pago)
      .map(([mes]) => mes as YearMonth);
    const automaticos = mesReferencia
      ? mesesPagosComoAutoDebit(f, mesReferencia).filter((mes) =>
          fixaEfetivamentePaga(f, mes, mesReferencia, hoje),
        )
      : [];
    return s + f.valor * new Set([...marcados, ...automaticos]).size;
  }, 0);
  return cargas + despesas + fixas;
}

/** Preço por kWh do carregamento mais recente feito neste local, se houver.
 *
 *  Serve de referência para adivinhar os kWh a partir do custo: o posto é o
 *  mesmo, o preço quase sempre também. O mais RECENTE, e não uma média, porque
 *  o que interessa é o preço que está lá agora.
 *
 *  Só olha abastecimentos elétricos (`precoKwh` presente) — um posto pode
 *  servir os dois tipos (híbrido), e o preço por litro não serve de palpite
 *  pro preço por kWh nem vice-versa. */
export function precoKwhDoLocal(cargas: Abastecimento[], local: string): Cents | undefined {
  const nome = local.trim();
  if (!nome) return undefined;
  const doLocal = cargas.filter((c) => c.local === nome && c.precoKwh !== undefined);
  if (doLocal.length === 0) return undefined;
  const recente = doLocal.reduce((a, b) => (b.data > a.data ? b : a));
  return recente.precoKwh! > 0 ? recente.precoKwh : undefined;
}

/** Quantos kWh dá aquele custo àquele preço, já no formato do campo: vírgula
 *  decimal e 3 casas — a terceira faz diferença numa carga pequena. */
export function kwhPeloCusto(custo: Cents, precoKwh: Cents): string {
  return (custo / precoKwh).toFixed(3).replace(".", ",");
}

/** Preço por litro do abastecimento a combustível mais recente feito neste
 *  local — mesma lógica de `precoKwhDoLocal`, pro par de campos de litro. */
export function precoLitroDoLocal(cargas: Abastecimento[], local: string): Cents | undefined {
  const nome = local.trim();
  if (!nome) return undefined;
  const doLocal = cargas.filter((c) => c.local === nome && c.precoLitro !== undefined);
  if (doLocal.length === 0) return undefined;
  const recente = doLocal.reduce((a, b) => (b.data > a.data ? b : a));
  return recente.precoLitro! > 0 ? recente.precoLitro : undefined;
}

/** Quantos litros dá aquele custo àquele preço — mesmo formato de
 *  `kwhPeloCusto` (vírgula decimal, 3 casas). */
export function litrosPeloCusto(custo: Cents, precoLitro: Cents): string {
  return (custo / precoLitro).toFixed(3).replace(".", ",");
}

/** A despesa comum que nasce de uma recarga classificada por engano.
 *
 *  Acontece porque o reconhecimento do extrato só tem o texto: um supermercado
 *  que também é local de carregamento (o Continente, aqui) aparece igual nos
 *  dois casos, e não dá para acertar sempre no palpite. Daí a saída depois de
 *  gravado — o kWh e o preço/kWh ficam pelo caminho porque a compra nunca teve
 *  nenhum dos dois; o que se salva é dinheiro, data, onde e como se pagou.
 *
 *  Pura de propósito (mesmo molde de `dadosDaCarga`/`dadosDaTransferencia` na
 *  importação): quem grava é a tela. */
export function dadosDespesaDaCarga(
  carga: Abastecimento,
  categoria: string,
): Omit<DespesaCorrente, "id"> {
  return {
    descricao: carga.local,
    valor: carga.custo,
    data: carga.data,
    categoria: categoria.trim() || "Outros",
    contaCartao: carga.contaCartao,
    nota: carga.nota,
  };
}

export function lancamentosDoMesVeiculo(veiculo: DadosVeiculo, ym: YearMonth) {
  return {
    cargas: veiculo.cargas.filter((c) => mesDe(c.data) === ym),
    despesas: doMes(veiculo.despesas, ym),
  };
}
