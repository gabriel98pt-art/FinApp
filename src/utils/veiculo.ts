// Totais do veículo (seção 3, Parte A) — funções puras em centavos.
// Portado do financas.html: totVeh(ym) = cargas + despesas variáveis + fixas
// ativas do veículo, somado dentro do total geral de despesas do app.

import type { CargaEletrica, Cents, DadosVeiculo, DespesaCorrente, YearMonth } from "../types";
import { doMes, mesDe, totalDoMes } from "./calculos";
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "./fatura";

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
): Cents {
  const ativas = veiculo.despesasFixas.filter((f) => fixaAtivaNoMes(f, ym));
  if (ym === mesReal) {
    return ativas
      .filter((f) => fixaEfetivamentePaga(f, ym, mesReal))
      .reduce((s, f) => s + f.valor, 0);
  }
  return ativas.reduce((s, f) => s + f.valor, 0);
}

/** Total do veículo no mês — cargas + despesas variáveis + fixas (seção 3). */
export function totalVeiculoMes(veiculo: DadosVeiculo, ym: YearMonth, mesReal: YearMonth): Cents {
  return (
    totalCargasMes(veiculo, ym) +
    totalDespesasVeiculoMes(veiculo, ym) +
    contribuicaoFixasVeiculoMes(veiculo, ym, mesReal)
  );
}

/** Total acumulado de todos os tempos (para KPIs "geral"/"poupança"): cargas
 *  e despesas contam sempre (sempre realizadas); cada fixa conta o valor ×
 *  quantos meses foram marcados pagos — mesma filosofia "só o que foi
 *  realmente pago" aplicada ao histórico inteiro, não só ao mês corrente. */
export function totalVeiculoGeral(veiculo: DadosVeiculo): Cents {
  const cargas = veiculo.cargas.reduce((s, c) => s + c.custo, 0);
  const despesas = veiculo.despesas.reduce((s, d) => s + d.valor, 0);
  const fixas = veiculo.despesasFixas.reduce((s, f) => {
    const mesesPagos = Object.values(f.pagoPorMes).filter(Boolean).length;
    return s + f.valor * mesesPagos;
  }, 0);
  return cargas + despesas + fixas;
}

/** Preço por kWh do carregamento mais recente feito neste local, se houver.
 *
 *  Serve de referência para adivinhar os kWh a partir do custo: o posto é o
 *  mesmo, o preço quase sempre também. O mais RECENTE, e não uma média, porque
 *  o que interessa é o preço que está lá agora. */
export function precoKwhDoLocal(cargas: CargaEletrica[], local: string): Cents | undefined {
  const nome = local.trim();
  if (!nome) return undefined;
  const doLocal = cargas.filter((c) => c.local === nome);
  if (doLocal.length === 0) return undefined;
  const recente = doLocal.reduce((a, b) => (b.data > a.data ? b : a));
  return recente.precoKwh > 0 ? recente.precoKwh : undefined;
}

/** Quantos kWh dá aquele custo àquele preço, já no formato do campo: vírgula
 *  decimal e 3 casas — a terceira faz diferença numa carga pequena. */
export function kwhPeloCusto(custo: Cents, precoKwh: Cents): string {
  return (custo / precoKwh).toFixed(3).replace(".", ",");
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
  carga: CargaEletrica,
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
