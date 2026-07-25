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
