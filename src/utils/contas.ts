// Resumo por conta/cartão (item 13) — o que cada conta movimentou no mês e,
// para as de débito, o saldo atual.
//
// Duas leituras diferentes de propósito, cada uma na medida certa do que a
// tela mostra:
//   - "gasto do mês" é por COMPETÊNCIA: uma fixa ativa no mês conta, tenha
//     sido marcada como paga ou não (é a mesma regra do cálculo da fatura);
//   - "saldo atual" é por CAIXA: só sai da conta o que de facto foi pago, ou
//     seja, fixa só entra nos meses marcados em `pagoPorMes`.
//
// Cargas e despesas do veículo entram nas duas quando têm conta/cartão, pela
// mesma regra das despesas correntes: é o mesmo dinheiro saindo da mesma
// conta. São opcionais em `DadosContas` porque o campo `contaCartao` delas é
// recente — quem não os passar continua com o comportamento antigo.

import type {
  CargaEletrica,
  Cents,
  ConfigConta,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  Receita,
  TipoCartao,
  Transferencia,
  YearMonth,
} from "../types";
import { mesDe } from "./calculos";
import { fixaAtivaNoMes, mesesPagosComoAutoDebit } from "./fatura";

export interface DadosContas {
  receitas: Receita[];
  despesasCorrentes: DespesaCorrente[];
  despesasFixas: DespesaFixa[];
  despesasFixasVeiculo: DespesaFixa[];
  transferencias: Transferencia[];
  /** Carregamentos e despesas variáveis do veículo pagos pela conta. */
  cargas?: CargaEletrica[];
  despesasVeiculo?: DespesaVeiculo[];
}

export interface ResumoConta {
  conta: string;
  tipo: TipoCartao;
  /** Competência: quanto a conta gastou no mês exibido. */
  gastoMes: Cents;
  /** Quantas movimentações (de qualquer sinal) tocaram a conta no mês. */
  transacoesMes: number;
  despesasMes: number;
  receitasMes: number;
  /** Caixa, acumulado desde o saldo inicial. Só faz sentido em débito. */
  saldoAtual: Cents;
}

/** Soma das fixas da conta ativas naquele mês (competência). */
function fixasDoMes(fixas: DespesaFixa[], conta: string, mes: YearMonth) {
  const ativas = fixas.filter((f) => f.contaCartao === conta && fixaAtivaNoMes(f, mes));
  return { total: ativas.reduce((s, f) => s + f.valor, 0), quantidade: ativas.length };
}

/** Soma das fixas da conta efetivamente pagas (caixa): os meses marcados à
 *  mão MAIS, para quem está em débito automático, os meses que já saíram
 *  sozinhos até `mesReferencia` (mesma regra de `totalFixasGeral`) — sem
 *  isto, uma fixa em débito automático nunca saía do saldo, porque ninguém a
 *  marca (é a promessa do débito automático). */
function fixasPagas(fixas: DespesaFixa[], conta: string, mesReferencia: YearMonth): Cents {
  return fixas
    .filter((f) => f.contaCartao === conta)
    .reduce((s, f) => {
      const marcados = Object.entries(f.pagoPorMes ?? {})
        .filter(([, pago]) => pago)
        .map(([mes]) => mes as YearMonth);
      const automaticos = mesesPagosComoAutoDebit(f, mesReferencia);
      return s + f.valor * new Set([...marcados, ...automaticos]).size;
    }, 0);
}

export function resumoDaConta(
  conta: string,
  dados: DadosContas,
  cfg: ConfigConta,
  mes: YearMonth,
): ResumoConta {
  const receitasMesLista = dados.receitas.filter((r) => r.conta === conta && mesDe(r.data) === mes);
  const correntesMes = dados.despesasCorrentes.filter(
    (d) => d.contaCartao === conta && mesDe(d.data) === mes,
  );
  const fixasGerais = fixasDoMes(dados.despesasFixas, conta, mes);
  const fixasVeiculo = fixasDoMes(dados.despesasFixasVeiculo, conta, mes);
  const saidasMes = dados.transferencias.filter((t) => t.de === conta && mesDe(t.data) === mes);
  const entradasMes = dados.transferencias.filter((t) => t.para === conta && mesDe(t.data) === mes);
  const cargasMes = (dados.cargas ?? []).filter(
    (c) => c.contaCartao === conta && mesDe(c.data) === mes,
  );
  const veiculoMes = (dados.despesasVeiculo ?? []).filter(
    (d) => d.contaCartao === conta && mesDe(d.data) === mes,
  );

  const gastoMes =
    correntesMes.reduce((s, d) => s + d.valor, 0) +
    fixasGerais.total +
    fixasVeiculo.total +
    saidasMes.reduce((s, t) => s + t.valor, 0) +
    cargasMes.reduce((s, c) => s + c.custo, 0) +
    veiculoMes.reduce((s, d) => s + d.valor, 0);

  const despesasMes =
    correntesMes.length +
    fixasGerais.quantidade +
    fixasVeiculo.quantidade +
    saidasMes.length +
    cargasMes.length +
    veiculoMes.length;
  const receitasMes = receitasMesLista.length + entradasMes.length;

  const saldoAtual =
    (cfg.saldosIniciais?.[conta] ?? 0) +
    dados.receitas.filter((r) => r.conta === conta).reduce((s, r) => s + r.valor, 0) +
    dados.transferencias.filter((t) => t.para === conta).reduce((s, t) => s + t.valor, 0) -
    dados.despesasCorrentes
      .filter((d) => d.contaCartao === conta)
      .reduce((s, d) => s + d.valor, 0) -
    dados.transferencias.filter((t) => t.de === conta).reduce((s, t) => s + t.valor, 0) -
    fixasPagas(dados.despesasFixas, conta, mes) -
    fixasPagas(dados.despesasFixasVeiculo, conta, mes) -
    (dados.cargas ?? []).filter((c) => c.contaCartao === conta).reduce((s, c) => s + c.custo, 0) -
    (dados.despesasVeiculo ?? [])
      .filter((d) => d.contaCartao === conta)
      .reduce((s, d) => s + d.valor, 0);

  return {
    conta,
    tipo: cfg.tipoCartao?.[conta] === "credit" ? "credit" : "debit",
    gastoMes,
    transacoesMes: despesasMes + receitasMes,
    despesasMes,
    receitasMes,
    saldoAtual,
  };
}

/** Saldo inicial necessário para que o saldo atual calculado bata com `alvo`,
 *  mantendo os mesmos movimentos já lançados.
 *
 *  É assim que o usuário acerta a conta pelo extrato do banco: ele diz quanto
 *  tem AGORA e o app descobre de onde tinha de ter partido. Editar o saldo
 *  inicial à mão obrigava-o a fazer esta subtração de cabeça. */
export function saldoInicialParaAlvo(
  resumo: ResumoConta,
  saldoInicialAtual: Cents,
  alvo: Cents,
): Cents {
  const movimentos = resumo.saldoAtual - saldoInicialAtual;
  return alvo - movimentos;
}

export function resumosDasContas(
  dados: DadosContas,
  cfg: ConfigConta,
  mes: YearMonth,
): ResumoConta[] {
  return cfg.contasCartoes.map((c) => resumoDaConta(c, dados, cfg, mes));
}
