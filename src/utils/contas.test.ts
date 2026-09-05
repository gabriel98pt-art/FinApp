import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";
import { resumoDaConta, resumosDasContas, saldoInicialParaAlvo, type DadosContas } from "./contas";

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

describe("saldo por caixa com fixa em débito automático", () => {
  // Fixa de renda que sai sozinha da conta desde março, sem ninguém marcar
  // `pagoPorMes` — é a promessa do débito automático.
  const comAutoDebit: DadosContas = {
    ...dados,
    despesasFixas: [
      {
        id: "f2",
        descricao: "Renda",
        valor: 50000,
        categoria: "Casa",
        contaCartao: "Conta",
        inicio: "2026-03",
        autoDebit: true,
        pagoPorMes: {},
      },
    ],
  };

  it("desconta do saldo os meses já vencidos, mesmo sem marcação manual", () => {
    // 100000 inicial + 250000 receitas - 8000 corrente - 10000 saída
    // - 50000 × 5 meses de renda (março a julho)
    const conta = resumoDaConta("Conta", comAutoDebit, cfg, "2026-07");
    expect(conta.saldoAtual).toBe(100000 + 250000 - 8000 - 10000 - 50000 * 5);
  });

  it("não conta o mesmo mês duas vezes quando também está marcado à mão", () => {
    const comMarcacaoDuplicada: DadosContas = {
      ...comAutoDebit,
      despesasFixas: [{ ...comAutoDebit.despesasFixas[0], pagoPorMes: { "2026-03": true } }],
    };
    const semDuplicar = resumoDaConta("Conta", comAutoDebit, cfg, "2026-07");
    const comDuplicar = resumoDaConta("Conta", comMarcacaoDuplicada, cfg, "2026-07");
    expect(comDuplicar.saldoAtual).toBe(semDuplicar.saldoAtual);
  });

  it("com `hoje`, só desconta o mês corrente depois do dia de vencimento", () => {
    const comVencimento: DadosContas = {
      ...comAutoDebit,
      despesasFixas: [{ ...comAutoDebit.despesasFixas[0], diaVencimento: 27 }],
    };
    const antesDoVencimento = resumoDaConta("Conta", comVencimento, cfg, "2026-07", "2026-07-10");
    const depoisDoVencimento = resumoDaConta("Conta", comVencimento, cfg, "2026-07", "2026-07-27");
    // Antes do dia 27: só março a junho (4 meses) já saíram, julho ainda não.
    expect(antesDoVencimento.saldoAtual).toBe(100000 + 250000 - 8000 - 10000 - 50000 * 4);
    // A partir do dia 27: julho também já saiu (5 meses, março a julho).
    expect(depoisDoVencimento.saldoAtual).toBe(100000 + 250000 - 8000 - 10000 - 50000 * 5);
  });

  it("sem `hoje`, o mês corrente conta inteiro desde o dia 1 (comportamento de sempre)", () => {
    const comVencimento: DadosContas = {
      ...comAutoDebit,
      despesasFixas: [{ ...comAutoDebit.despesasFixas[0], diaVencimento: 27 }],
    };
    const conta = resumoDaConta("Conta", comVencimento, cfg, "2026-07");
    expect(conta.saldoAtual).toBe(100000 + 250000 - 8000 - 10000 - 50000 * 5);
  });

  it("navegar para um mês passado não esconde meses já debitados até hoje", () => {
    const comVencimento: DadosContas = {
      ...comAutoDebit,
      despesasFixas: [{ ...comAutoDebit.despesasFixas[0], diaVencimento: 27 }],
    };
    // Hoje é agosto, depois do vencimento: março a agosto (6 meses) já saíram
    // da conta. O usuário está só a ver julho no Cartões — o saldo é o mesmo
    // dinheiro, não pode depender de qual mês está na tela.
    const vendoJulho = resumoDaConta("Conta", comVencimento, cfg, "2026-07", "2026-08-30");
    const vendoAgosto = resumoDaConta("Conta", comVencimento, cfg, "2026-08", "2026-08-30");
    expect(vendoJulho.saldoAtual).toBe(100000 + 250000 - 8000 - 10000 - 50000 * 6);
    expect(vendoJulho.saldoAtual).toBe(vendoAgosto.saldoAtual);
  });
});

describe("espelho de fixa paga não conta em dobro (origem 'fixa')", () => {
  // Marcar uma fixa como paga grava DUAS coisas atomicamente (ver
  // alternarPagoDespesaFixa/alternarPagoFixaVeiculo): `pagoPorMes` E um
  // lançamento-espelho em despesasCorrentes/despesasVeiculo com o mesmo
  // valor, a mesma conta e `origem: "fixa"` — só para o Início saber a data
  // real do pagamento. O valor da fixa já entra no resumo da conta por
  // `fixasDoMes` (competência) e `fixasPagas` (caixa); somar o espelho
  // também contava a mesma renda duas vezes.
  const comEspelho: DadosContas = {
    ...dados,
    despesasCorrentes: [
      ...dados.despesasCorrentes,
      {
        id: "espelho-f1",
        descricao: "Renda",
        valor: 50000,
        categoria: "Casa",
        contaCartao: "Conta",
        data: "2026-07-05",
        origem: "fixa",
      },
    ],
  };

  it("gastoMes ignora o espelho — o valor da fixa já entra por competência", () => {
    const semEspelho = resumoDaConta("Conta", dados, cfg, "2026-07");
    const comoEspelho = resumoDaConta("Conta", comEspelho, cfg, "2026-07");
    expect(comoEspelho.gastoMes).toBe(semEspelho.gastoMes);
  });

  it("saldoAtual ignora o espelho — o valor da fixa já sai por fixasPagas", () => {
    const semEspelho = resumoDaConta("Conta", dados, cfg, "2026-07");
    const comoEspelho = resumoDaConta("Conta", comEspelho, cfg, "2026-07");
    expect(comoEspelho.saldoAtual).toBe(semEspelho.saldoAtual);
  });

  it("mesma exclusão para o espelho de fixa do veículo", () => {
    const base: DadosContas = {
      ...dados,
      despesasFixasVeiculo: [
        {
          id: "fv1",
          descricao: "Seguro",
          valor: 20000,
          categoria: "Veículo",
          contaCartao: "Conta",
          pagoPorMes: { "2026-07": true },
        },
      ],
    };
    const comEspelhoVeiculo: DadosContas = {
      ...base,
      despesasVeiculo: [
        {
          id: "espelho-fv1",
          data: "2026-07-05",
          valor: 20000,
          categoria: "Veículo",
          contaCartao: "Conta",
          origem: "fixa",
        },
      ],
    };
    const semEspelho = resumoDaConta("Conta", base, cfg, "2026-07");
    const comoEspelho = resumoDaConta("Conta", comEspelhoVeiculo, cfg, "2026-07");
    expect(comoEspelho.gastoMes).toBe(semEspelho.gastoMes);
    expect(comoEspelho.saldoAtual).toBe(semEspelho.saldoAtual);
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

describe("saldoInicialParaAlvo — acertar a conta pelo extrato do banco", () => {
  // O usuário nunca digita o saldo inicial: digita o que a conta tem hoje.
  const resumo = (saldoAtual: number) => ({
    ...resumoDaConta("Conta", dados, cfg, "2026-07"),
    saldoAtual,
  });

  it("sem saldo inicial, o inicial que falta é a diferença exata até ao alvo", () => {
    expect(saldoInicialParaAlvo(resumo(30000), 0, 50000)).toBe(20000);
    expect(saldoInicialParaAlvo(resumo(30000), 0, 10000)).toBe(-20000);
  });

  it("com saldo inicial já definido, os movimentos é que se mantêm", () => {
    // Movimentos = 130000 - 100000 = 30000. Para chegar a 50000 é preciso 20000.
    expect(saldoInicialParaAlvo(resumo(130000), 100000, 50000)).toBe(20000);
  });

  it("alvo igual ao saldo atual não mexe no inicial", () => {
    expect(saldoInicialParaAlvo(resumo(130000), 100000, 130000)).toBe(100000);
  });

  it("aceita alvo negativo — a conta pode estar no vermelho", () => {
    expect(saldoInicialParaAlvo(resumo(5000), 20000, -3000)).toBe(12000);
  });
});
