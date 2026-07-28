import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";
import { resumoDaConta, resumosDasContas, type DadosContas } from "./contas";

const cfg: ConfigConta = {
  ...CONFIG_PADRAO,
  contasCartoes: ["Conta", "Gold"],
  tipoCartao: { Conta: "debit", Gold: "credit" },
  saldosIniciais: { Conta: 100000 },
};

const dados: DadosContas = {
  receitas: [
    {
      id: "r1",
      descricao: "Salário",
      valor: 200000,
      data: "2026-07-05",
      fonte: "Salário",
      conta: "Conta",
    },
    {
      id: "r2",
      descricao: "Antigo",
      valor: 50000,
      data: "2026-06-05",
      fonte: "Extra",
      conta: "Conta",
    },
  ],
  despesasCorrentes: [
    {
      id: "d1",
      descricao: "Mercado",
      valor: 8000,
      data: "2026-07-10",
      categoria: "Alimentação",
      contaCartao: "Conta",
    },
    {
      id: "d2",
      descricao: "Loja",
      valor: 3000,
      data: "2026-07-11",
      categoria: "Compras",
      contaCartao: "Gold",
    },
  ],
  despesasFixas: [
    {
      id: "f1",
      descricao: "Renda",
      valor: 50000,
      categoria: "Casa",
      contaCartao: "Conta",
      pagoPorMes: { "2026-06": true, "2026-07": true },
    },
  ],
  despesasFixasVeiculo: [],
  transferencias: [{ id: "t1", data: "2026-07-20", de: "Conta", para: "Gold", valor: 10000 }],
};

describe("resumoDaConta", () => {
  const conta = resumoDaConta("Conta", dados, cfg, "2026-07");

  it("soma o gasto do mês por competência (fixa ativa conta, paga ou não)", () => {
    // 8000 (corrente) + 50000 (fixa) + 10000 (transferência de saída)
    expect(conta.gastoMes).toBe(68000);
  });

  it("conta as movimentações do mês dos dois lados", () => {
    expect(conta.despesasMes).toBe(3); // corrente + fixa + saída
    expect(conta.receitasMes).toBe(1); // salário de julho
    expect(conta.transacoesMes).toBe(4);
  });

  it("calcula o saldo por caixa, com as fixas só nos meses pagos", () => {
    // 100000 inicial + 250000 receitas - 8000 corrente - 10000 saída - 100000 (2 meses de renda)
    expect(conta.saldoAtual).toBe(232000);
  });

  it("credita a transferência recebida na conta de destino", () => {
    const gold = resumoDaConta("Gold", dados, cfg, "2026-07");
    expect(gold.tipo).toBe("credit");
    expect(gold.gastoMes).toBe(3000);
    expect(gold.receitasMes).toBe(1);
    expect(gold.saldoAtual).toBe(7000); // 10000 recebidos - 3000 gastos
  });

  it("não quebra com conta sem movimento nenhum", () => {
    const vazia = resumoDaConta("Inexistente", dados, cfg, "2026-07");
    expect(vazia.gastoMes).toBe(0);
    expect(vazia.transacoesMes).toBe(0);
    expect(vazia.saldoAtual).toBe(0);
  });
});

describe("resumosDasContas", () => {
  it("devolve um resumo por conta configurada, na mesma ordem", () => {
    expect(resumosDasContas(dados, cfg, "2026-07").map((r) => r.conta)).toEqual(["Conta", "Gold"]);
  });
});

describe("carga e despesa do veículo no resumo da conta", () => {
  // Mesmo cenário do `dados` acima, com o veículo a pagar pelo cartão Gold.
  const comVeiculo: DadosContas = {
    ...dados,
    cargas: [
      {
        id: "c1",
        data: "2026-07-06",
        kwh: 30,
        precoKwh: 25,
        custo: 750,
        local: "Casa",
        contaCartao: "Gold",
      },
      // junho: fica fora do mês, mas pesa no saldo acumulado
      {
        id: "c2",
        data: "2026-06-06",
        kwh: 20,
        precoKwh: 25,
        custo: 500,
        local: "Casa",
        contaCartao: "Gold",
      },
      // sem conta e de outra conta: não entram no Gold
      { id: "c3", data: "2026-07-07", kwh: 10, precoKwh: 25, custo: 250, local: "Casa" },
      {
        id: "c4",
        data: "2026-07-08",
        kwh: 10,
        precoKwh: 25,
        custo: 999,
        local: "Casa",
        contaCartao: "Conta",
      },
    ],
    despesasVeiculo: [
      { id: "dv1", data: "2026-07-09", valor: 8900, categoria: "Manutenção", contaCartao: "Gold" },
      { id: "dv2", data: "2026-06-09", valor: 1500, categoria: "Portagens", contaCartao: "Gold" },
      { id: "dv3", data: "2026-07-09", valor: 4444, categoria: "Revisão" },
    ],
  };

  const gold = resumoDaConta("Gold", comVeiculo, cfg, "2026-07");
  const semVeiculo = resumoDaConta("Gold", dados, cfg, "2026-07");

  it("soma a carga e a despesa do veículo do mês no gasto do cartão", () => {
    // 3000 (corrente) + 750 (carga de julho) + 8900 (despesa de julho)
    expect(gold.gastoMes).toBe(12650);
    expect(gold.gastoMes - semVeiculo.gastoMes).toBe(9650);
  });

  it("conta-as como movimentações do mês", () => {
    expect(gold.despesasMes).toBe(semVeiculo.despesasMes + 2);
    expect(gold.transacoesMes).toBe(semVeiculo.transacoesMes + 2);
  });

  it("desconta TODAS as do cartão no saldo, não só as do mês exibido", () => {
    // saldo sem veículo: 7000. Menos 750 + 500 (cargas) + 8900 + 1500 (despesas).
    expect(gold.saldoAtual).toBe(7000 - 750 - 500 - 8900 - 1500);
  });

  it("ignora as de outra conta e as sem conta nenhuma", () => {
    // A conta de débito só recebe a carga c4 (999), nada de despesa do veículo.
    const conta = resumoDaConta("Conta", comVeiculo, cfg, "2026-07");
    const contaSem = resumoDaConta("Conta", dados, cfg, "2026-07");
    expect(conta.gastoMes - contaSem.gastoMes).toBe(999);
    expect(conta.saldoAtual - contaSem.saldoAtual).toBe(-999);
    // c3 e dv3 (sem conta) não caem em lugar nenhum
    const total = resumosDasContas(comVeiculo, cfg, "2026-07").reduce((s, r) => s + r.gastoMes, 0);
    const totalSem = resumosDasContas(dados, cfg, "2026-07").reduce((s, r) => s + r.gastoMes, 0);
    expect(total - totalSem).toBe(999 + 750 + 8900);
  });

  it("sem os campos novos, o resumo é o mesmo de antes", () => {
    expect(resumoDaConta("Gold", dados, cfg, "2026-07")).toEqual(semVeiculo);
  });
});
