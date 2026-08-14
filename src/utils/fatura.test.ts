import { describe, expect, test } from "vitest";
import type {
  CargaEletrica,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  Parcela,
  Receita,
  Transferencia,
} from "../types";
import { despesasNosTotais } from "./calculos";
import {
  calcularFatura,
  calcularFaturaAutomatica,
  cicloDaFatura,
  fixaEfetivamentePaga,
  mesDoCiclo,
  pagamentosDaFatura,
  type DadosFatura,
} from "./fatura";

const CARTAO = "AB Gold (C)";

function dc(extra: Partial<DespesaCorrente>): DespesaCorrente {
  return {
    id: Math.random().toString(36).slice(2),
    descricao: "compra",
    valor: 1000,
    data: "2026-06-10",
    categoria: "Compras",
    contaCartao: CARTAO,
    ...extra,
  };
}

function carga(extra: Partial<CargaEletrica>): CargaEletrica {
  return {
    id: Math.random().toString(36).slice(2),
    data: "2026-06-12",
    kwh: 30,
    precoKwh: 25,
    custo: 750,
    local: "Casa",
    contaCartao: CARTAO,
    ...extra,
  };
}

function dv(extra: Partial<DespesaVeiculo>): DespesaVeiculo {
  return {
    id: Math.random().toString(36).slice(2),
    data: "2026-06-18",
    valor: 5000,
    categoria: "Manutenção",
    contaCartao: CARTAO,
    ...extra,
  };
}

const vazio: DadosFatura = {
  despesasFixas: [],
  despesasFixasVeiculo: [],
  despesasCorrentes: [],
  parcelas: [],
  transferencias: [],
};

test("ciclo da fatura é o mês civil anterior (fatura de julho = gastos de junho)", () => {
  expect(cicloDaFatura("2026-07")).toBe("2026-06");
  expect(cicloDaFatura("2026-01")).toBe("2025-12");
});

describe("mesDoCiclo — em que ciclo cai uma data, dado o dia de fechamento", () => {
  test("sem fechamento, o ciclo é o mês civil da data — comportamento de sempre", () => {
    expect(mesDoCiclo("2026-06-01")).toBe("2026-06");
    expect(mesDoCiclo("2026-06-30")).toBe("2026-06");
  });

  test("com fechamento, compra até o dia (inclusive) fica no mês em que aconteceu", () => {
    expect(mesDoCiclo("2026-06-05", 5)).toBe("2026-06");
    expect(mesDoCiclo("2026-06-01", 5)).toBe("2026-06");
  });

  test("com fechamento, compra depois do dia entra no ciclo do mês seguinte", () => {
    expect(mesDoCiclo("2026-06-06", 5)).toBe("2026-07");
    expect(mesDoCiclo("2026-06-30", 5)).toBe("2026-07");
  });

  test("fechamento além do fim do mês prende no último dia real (fevereiro)", () => {
    expect(mesDoCiclo("2026-02-28", 31)).toBe("2026-02");
    expect(mesDoCiclo("2026-03-01", 31)).toBe("2026-03");
  });
});

describe("calcularFaturaAutomatica (seção 4.1)", () => {
  test("soma as 5 fontes do ciclo", () => {
    const fixa: DespesaFixa = {
      id: "f1",
      descricao: "Streaming",
      valor: 999,
      categoria: "Casa",
      contaCartao: CARTAO,
      pagoPorMes: {},
    };
    const fixaVeiculo: DespesaFixa = {
      id: "fv1",
      descricao: "Seguro",
      valor: 4500,
      categoria: "Veículo",
      contaCartao: CARTAO,
      pagoPorMes: {},
    };
    const parcela: Parcela = {
      id: "p1",
      descricao: "Telemóvel",
      total: 30000,
      numParcelas: 10,
      primeiroMes: "2026-01",
      cartao: CARTAO,
      autoDebit: true,
      pagoPorMes: {},
    };
    const trf: Transferencia = {
      id: "t1",
      data: "2026-06-20",
      de: CARTAO,
      para: "Conta Principal",
      valor: 2000,
    };
    const dados: DadosFatura = {
      despesasFixas: [fixa],
      despesasFixasVeiculo: [fixaVeiculo],
      despesasCorrentes: [dc({ valor: 1500 })],
      parcelas: [parcela],
      transferencias: [trf],
    };
    // 999 + 4500 + 1500 + 3000 (30000/10) + 2000
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(11999);
  });

  // Estes três nasceram de dinheiro real: a fatura do AB Gold pedia mais do
  // que o banco cobrava, e a diferença era um cashback de 2% e o estorno de
  // uma comissão de limite excedido — os dois lançados como RECEITA no cartão,
  // que é o que o próprio importador de extrato do app faz com um crédito.
  // Sem isto o erro era invisível: cartão de crédito não mostra saldo em lado
  // nenhum, só a fatura, e a fatura ignorava-os.
  function credito(extra: Partial<Receita>): Receita {
    return {
      id: Math.random().toString(36).slice(2),
      descricao: "cashback",
      valor: 500,
      data: "2026-06-15",
      fonte: "Outros",
      conta: CARTAO,
      ...extra,
    };
  }

  test("crédito no cartão (cashback/estorno) reduz o devido", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [dc({ valor: 5000 })],
      receitas: [credito({ valor: 1632 })],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(5000 - 1632);
  });

  test("crédito só conta se for do cartão e do ciclo", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [dc({ valor: 5000 })],
      receitas: [
        credito({ valor: 1000, conta: "Conta Principal" }), // outra conta
        credito({ valor: 2000, data: "2026-07-15" }), // outro ciclo
        credito({ valor: 300 }), // este conta
      ],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(4700);
  });

  test("mês só de estornos deixa o devido negativo, mas o restante em zero", () => {
    // O cartão fica mesmo a crédito. Cortar o devido em zero aqui esconderia
    // dinheiro que é do usuário; quem mostra "a pagar" usa `restante`.
    const dados: DadosFatura = { ...vazio, receitas: [credito({ valor: 2500 })] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(-2500);
    expect(calcularFatura(CARTAO, "2026-07", dados, {}).restante).toBe(0);
  });

  test("só entra o que é do cartão e do ciclo", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [
        dc({ valor: 1500 }), // junho, este cartão → entra na fatura de julho
        dc({ valor: 9999, data: "2026-07-01" }), // julho → fatura de agosto
        dc({ valor: 7777, contaCartao: "Outro Cartão" }),
        dc({ valor: 5555, contaCartao: undefined }),
      ],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(1500);
    expect(calcularFaturaAutomatica(CARTAO, "2026-08", dados)).toBe(9999);
  });

  test("fixa respeita janela inicio/fim no ciclo", () => {
    const fixa: DespesaFixa = {
      id: "f1",
      descricao: "Ginásio",
      valor: 3000,
      categoria: "Saúde",
      contaCartao: CARTAO,
      inicio: "2026-07",
      fim: "2026-09",
      pagoPorMes: {},
    };
    const dados = { ...vazio, despesasFixas: [fixa] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(0); // ciclo jun < início
    expect(calcularFaturaAutomatica(CARTAO, "2026-08", dados)).toBe(3000); // ciclo jul
    expect(calcularFaturaAutomatica(CARTAO, "2026-11", dados)).toBe(0); // ciclo out > fim
  });

  test("despesa fixa geral (não do veículo) vinculada ao cartão entra no cálculo", () => {
    const fixaGeral: DespesaFixa = {
      id: "fg1",
      descricao: "Netflix",
      valor: 1500,
      categoria: "Assinaturas",
      contaCartao: CARTAO,
      pagoPorMes: {},
    };
    const dados: DadosFatura = { ...vazio, despesasFixas: [fixaGeral] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(1500);
    // vinculada a outro cartão: não entra
    const outro = { ...fixaGeral, contaCartao: "Outro Cartão" };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", { ...vazio, despesasFixas: [outro] })).toBe(
      0,
    );
  });

  test("transferência de saída contra o cartão de crédito entra no cálculo", () => {
    const saida: Transferencia = {
      id: "t1",
      data: "2026-06-15",
      de: CARTAO,
      para: "Conta Principal",
      valor: 3000,
    };
    const dados: DadosFatura = { ...vazio, transferencias: [saida] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(3000);
    // transferência de ENTRADA no cartão (para, não de) não entra
    const entrada: Transferencia = { ...saida, id: "t2", de: "Conta Principal", para: CARTAO };
    expect(
      calcularFaturaAutomatica(CARTAO, "2026-07", { ...vazio, transferencias: [entrada] }),
    ).toBe(0);
  });

  test("BUG 1 (não reproduzir): pagamento de fatura no ciclo não entra na fatura seguinte", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [
        dc({ valor: 1500 }),
        // pagamento da fatura de junho, registrado em junho contra este cartão:
        // sem a exclusão de origem 'fat', entraria em contagem circular
        dc({ valor: 8000, origem: "fat", descricao: "Cartão de Crédito AB Gold (C)" }),
      ],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(1500);
  });

  test("carga elétrica paga no cartão entra no devido do ciclo", () => {
    const dados: DadosFatura = { ...vazio, cargas: [carga({ custo: 2500 })] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(2500);
  });

  test("despesa do veículo paga no cartão entra no devido do ciclo", () => {
    const dados: DadosFatura = { ...vazio, despesasVeiculo: [dv({ valor: 8900 })] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(8900);
  });

  test("carga/despesa do veículo de outro cartão, sem cartão ou de outro ciclo ficam de fora", () => {
    const dados: DadosFatura = {
      ...vazio,
      cargas: [
        carga({ custo: 2500 }), // junho, este cartão → entra
        carga({ custo: 1111, contaCartao: "Outro Cartão" }),
        carga({ custo: 2222, contaCartao: undefined }),
        carga({ custo: 3333, data: "2026-07-05" }), // ciclo de agosto
      ],
      despesasVeiculo: [
        dv({ valor: 8900 }), // junho, este cartão → entra
        dv({ valor: 4444, contaCartao: "Outro Cartão" }),
        dv({ valor: 5555, contaCartao: undefined }),
        dv({ valor: 6666, data: "2026-07-05" }), // ciclo de agosto
      ],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(2500 + 8900);
    expect(calcularFaturaAutomatica(CARTAO, "2026-08", dados)).toBe(3333 + 6666);
    expect(calcularFaturaAutomatica("Outro Cartão", "2026-07", dados)).toBe(1111 + 4444);
  });

  test("cargas/despesas do veículo somam junto com as demais fontes", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [dc({ valor: 1500 })],
      cargas: [carga({ custo: 2500 })],
      despesasVeiculo: [dv({ valor: 8900 })],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(1500 + 2500 + 8900);
  });

  // Cartão que fecha dia 5 (não no fim do mês): uma compra de 6/06 já cai no
  // ciclo de julho, não no de junho — desloca-a pra fatura de setembro
  // (ciclo julho = mesFatura - 1 = agosto → fatura de setembro), não a de
  // agosto (que cobriria o ciclo de julho normal, sem fechamento antecipado).
  test("com dia de fechamento, compra depois dele entra no ciclo do mês seguinte", () => {
    const dados: DadosFatura = {
      ...vazio,
      despesasCorrentes: [
        dc({ valor: 1000, data: "2026-07-05" }), // no fechamento: fica em julho
        dc({ valor: 2000, data: "2026-07-06" }), // depois: passa pro ciclo de agosto
      ],
    };
    // ciclo de julho → fatura de agosto: só a primeira compra
    expect(calcularFaturaAutomatica(CARTAO, "2026-08", dados, 5)).toBe(1000);
    // ciclo de agosto → fatura de setembro: só a segunda
    expect(calcularFaturaAutomatica(CARTAO, "2026-09", dados, 5)).toBe(2000);
  });

  test("sem dia de fechamento, nada muda em relação ao comportamento antigo", () => {
    const dados: DadosFatura = { ...vazio, despesasCorrentes: [dc({ valor: 1000 })] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", dados)).toBe(
      calcularFaturaAutomatica(CARTAO, "2026-07", dados, undefined),
    );
  });
});

describe("parcelas autoDebit vs estado de pagamento (double-charge do app antigo)", () => {
  const parcela: Parcela = {
    id: "p1",
    descricao: "Telemóvel",
    total: 30000,
    numParcelas: 10,
    primeiroMes: "2026-01",
    cartao: CARTAO,
    autoDebit: true,
    pagoPorMes: {},
  };

  test("mês quitado antecipadamente (true) sai das faturas futuras", () => {
    const quitada = { ...parcela, pagoPorMes: { "2026-06": true } as Parcela["pagoPorMes"] };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", { ...vazio, parcelas: [quitada] })).toBe(0);
  });

  test("mês quitado pela própria fatura ('fatura') continua no devido — histórico estável", () => {
    const viaFatura = {
      ...parcela,
      pagoPorMes: { "2026-06": "fatura" } as Parcela["pagoPorMes"],
    };
    expect(calcularFaturaAutomatica(CARTAO, "2026-07", { ...vazio, parcelas: [viaFatura] })).toBe(
      3000,
    );
  });
});

describe("override manual e pagamento parcial", () => {
  const dados: DadosFatura = { ...vazio, despesasCorrentes: [dc({ valor: 10000 })] };

  test("override manual prevalece sobre o automático", () => {
    const f = calcularFatura(CARTAO, "2026-07", dados, {
      faturaManual: { [CARTAO]: { "2026-07": 12345 } },
    });
    expect(f.devidoAutomatico).toBe(10000);
    expect(f.overrideManual).toBe(12345);
    expect(f.devido).toBe(12345);
  });

  test("pagamento parcial: restante = devido − pago, nunca negativo", () => {
    const cfg = {
      faturasPagas: {
        [CARTAO]: {
          "2026-07": {
            pagamentos: [
              { id: "a", data: "2026-07-05", valor: 4000 },
              { id: "b", data: "2026-07-15", valor: 3000 },
            ],
          },
        },
      },
    };
    const f = calcularFatura(CARTAO, "2026-07", dados, cfg);
    expect(f.pago).toBe(7000);
    expect(f.restante).toBe(3000);

    const pagoAMais = calcularFatura(CARTAO, "2026-07", dados, {
      faturasPagas: {
        [CARTAO]: { "2026-07": { pagamentos: [{ id: "a", data: "2026-07-05", valor: 99999 }] } },
      },
    });
    expect(pagoAMais.restante).toBe(0);
  });

  test("resolve o dia de fechamento do cfg pelo nome do cartão", () => {
    const dadosFechamento: DadosFatura = {
      ...vazio,
      despesasCorrentes: [dc({ valor: 2000, data: "2026-07-06" })], // depois do fechamento (5)
    };
    const cfg = { diaFechamentoFatura: { [CARTAO]: 5 } };
    // sem fechamento, a compra de 6/07 entraria na fatura de agosto (ciclo julho)
    expect(calcularFatura(CARTAO, "2026-08", dadosFechamento, {}).devidoAutomatico).toBe(2000);
    // com fechamento dia 5, ela passa pro ciclo de agosto → fatura de setembro
    expect(calcularFatura(CARTAO, "2026-08", dadosFechamento, cfg).devidoAutomatico).toBe(0);
    expect(calcularFatura(CARTAO, "2026-09", dadosFechamento, cfg).devidoAutomatico).toBe(2000);
  });

  test("compat retroativa: registro legado de pagamento único vira lista de 1", () => {
    expect(
      pagamentosDaFatura({ paid: true, val: 80.5, date: "2026-07-01", from: "AB (D)", dcId: 42 }),
    ).toEqual([{ id: "42", data: "2026-07-01", valor: 8050, de: "AB (D)" }]);
    expect(pagamentosDaFatura({ payments: [{ val: 10, date: "2026-07-02", dcId: 7 }] })).toEqual([
      { id: "7", data: "2026-07-02", valor: 1000, de: undefined },
    ]);
    expect(pagamentosDaFatura(undefined)).toEqual([]);
    expect(pagamentosDaFatura({ paid: false })).toEqual([]);
  });

  test("BUG 3 (não reproduzir): fatura já paga recalcula ao vivo — lançamento novo no ciclo reabre o restante", () => {
    const cfg = {
      faturasPagas: {
        [CARTAO]: { "2026-07": { pagamentos: [{ id: "a", data: "2026-07-05", valor: 10000 }] } },
      },
    };
    // paga por completo…
    expect(calcularFatura(CARTAO, "2026-07", dados, cfg).restante).toBe(0);
    // …aí chega uma compra atrasada do ciclo de junho: o devido NÃO fica
    // congelado num valor velho — a fatura reabre de forma visível
    const dadosNovos = {
      ...dados,
      despesasCorrentes: [...dados.despesasCorrentes, dc({ valor: 2500, data: "2026-06-28" })],
    };
    const f = calcularFatura(CARTAO, "2026-07", dadosNovos, cfg);
    expect(f.devido).toBe(12500);
    expect(f.restante).toBe(2500);
  });
});

describe("BUG 1/2 (não reproduzir): destino único de cada lançamento nos totais", () => {
  test("pagamento de fatura fica fora dos totais de despesa (a compra já contou)", () => {
    const compra = dc({ valor: 1500 });
    const pagamento = dc({
      valor: 8000,
      origem: "fat",
      data: "2026-07-02",
      categoria: "Cartão de Crédito",
    });
    const contadas = despesasNosTotais([compra, pagamento]);
    expect(contadas).toEqual([compra]);
  });

  test("espelho de parcela (origem parc) fica fora dos totais — conta pelo plano", () => {
    // A parcela entra nos totais por contribuicaoParcelasMes (utils/parcelas.ts),
    // que conta o plano inteiro no mês fechado. Somar também o espelho criado
    // ao marcar "Pagar" seria contar duas vezes — o espelho segue existindo
    // para o extrato por conta, só não entra nesta soma.
    const compra = dc({ valor: 1500 });
    const parcelaMensal = dc({ valor: 1867, origem: "parc", categoria: "Parcelas" });
    expect(despesasNosTotais([compra, parcelaMensal])).toEqual([compra]);
  });

  test("ajuste de reconciliação (origem recon) fica fora dos totais — não é despesa real", () => {
    const compra = dc({ valor: 1500 });
    const ajuste = dc({ valor: 500000, origem: "recon", categoria: "Ajuste" });
    expect(despesasNosTotais([compra, ajuste])).toEqual([compra]);
  });
});

describe("fixaEfetivamentePaga — a fixa em débito automático que ninguém marca", () => {
  function fixa(extra: Partial<DespesaFixa> = {}): DespesaFixa {
    return {
      id: "f1",
      descricao: "Seguro",
      valor: 4500,
      categoria: "Seguro",
      pagoPorMes: {},
      ...extra,
    };
  }

  test("marcada à mão conta sempre, com ou sem mês de referência", () => {
    const f = fixa({ pagoPorMes: { "2026-07": true } });
    expect(fixaEfetivamentePaga(f, "2026-07")).toBe(true);
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-08")).toBe(true);
    expect(fixaEfetivamentePaga(f, "2026-06", "2026-08")).toBe(false);
  });

  test("no cartão em débito automático conta sem marcação, até ao mês de referência", () => {
    const f = fixa({ contaCartao: CARTAO, autoDebit: true, inicio: "2026-01" });
    expect(fixaEfetivamentePaga(f, "2026-06", "2026-08")).toBe(true);
    expect(fixaEfetivamentePaga(f, "2026-08", "2026-08")).toBe(true);
    // Mês que ainda não chegou: não saiu dinheiro nenhum.
    expect(fixaEfetivamentePaga(f, "2026-09", "2026-08")).toBe(false);
  });

  test("sem mês de referência nada muda — só o que está marcado", () => {
    const f = fixa({ contaCartao: CARTAO, autoDebit: true, inicio: "2026-01" });
    expect(fixaEfetivamentePaga(f, "2026-06")).toBe(false);
  });

  test("sem conta/cartão o autoDebit não vale — não há de onde sair sozinho", () => {
    const f = fixa({ autoDebit: true, inicio: "2026-01" });
    expect(fixaEfetivamentePaga(f, "2026-06", "2026-08")).toBe(false);
  });

  test("no cartão mas sem autoDebit continua a precisar da marcação", () => {
    const f = fixa({ contaCartao: CARTAO, inicio: "2026-01" });
    expect(fixaEfetivamentePaga(f, "2026-06", "2026-08")).toBe(false);
  });

  // Quem chama nem sempre filtra pelo plano antes (o extrato percorre todas).
  test("fora do plano da fixa não conta, mesmo em débito automático", () => {
    const f = fixa({ contaCartao: CARTAO, autoDebit: true, inicio: "2026-05", fim: "2026-07" });
    expect(fixaEfetivamentePaga(f, "2026-04", "2026-08")).toBe(false);
    expect(fixaEfetivamentePaga(f, "2026-05", "2026-08")).toBe(true);
    expect(fixaEfetivamentePaga(f, "2026-08", "2026-08")).toBe(false);
  });

  test("pagoPorMes ausente (o RTDB apaga objeto vazio) não rebenta", () => {
    const f = { ...fixa(), pagoPorMes: undefined } as unknown as DespesaFixa;
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-08")).toBe(false);
  });

  // O bug: uma fixa que vence dia 27 aparecia como paga já no dia 1 do mês —
  // datada no futuro no extrato de Transações. `hoje` dá precisão de dia.
  describe("com `hoje`, precisão de dia no mês corrente", () => {
    test("não conta antes do dia de vencimento", () => {
      const f = fixa({ contaCartao: CARTAO, autoDebit: true, diaVencimento: 27 });
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-08")).toBe(false);
    });

    test("conta assim que o dia chega ou passa", () => {
      const f = fixa({ contaCartao: CARTAO, autoDebit: true, diaVencimento: 27 });
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-27")).toBe(true);
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-28")).toBe(true);
    });

    test("mês inteiramente fechado conta mesmo cedo no mês seguinte", () => {
      const f = fixa({ contaCartao: CARTAO, autoDebit: true, diaVencimento: 27 });
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-08", "2026-08-01")).toBe(true);
    });

    test("sem diaVencimento, espera o fim do mês em vez de supor o dia 1", () => {
      const f = fixa({ contaCartao: CARTAO, autoDebit: true });
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-15")).toBe(false);
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-31")).toBe(true);
    });

    test("sem `hoje`, mês inteiro conta desde o dia 1 — comportamento antigo", () => {
      const f = fixa({ contaCartao: CARTAO, autoDebit: true, diaVencimento: 27 });
      expect(fixaEfetivamentePaga(f, "2026-07", "2026-07")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Casos de borda: fechamento de ciclo nas pontas do mês e fixa sem dia próprio.
// ---------------------------------------------------------------------------

describe("fechamento de fatura nas pontas do dia e do mês", () => {
  test("a compra NO dia do fechamento ainda entra no ciclo que fecha", () => {
    // A fronteira é inclusiva, e é onde um erro de sinal se esconde: comprar
    // no próprio dia 5 tem de cair no ciclo de julho, não no de agosto. Errar
    // aqui empurra a compra um mês inteiro para a frente na fatura.
    expect(mesDoCiclo("2026-07-05", 5)).toBe("2026-07");
  });

  test("a compra no dia seguinte ao fechamento já é do ciclo seguinte", () => {
    expect(mesDoCiclo("2026-07-06", 5)).toBe("2026-08");
  });

  test("compra no último dia do mês, com fechamento no dia 5, vai para o mês seguinte", () => {
    // Fim de mês é onde as duas viradas coincidem — a do ciclo e a do
    // calendário. 31 de julho é depois do fechamento de 5 de julho, portanto
    // ciclo de agosto.
    expect(mesDoCiclo("2026-07-31", 5)).toBe("2026-08");
  });

  test("compra depois do fechamento em dezembro atravessa o ano", () => {
    // Se `somarMeses` não tratasse a virada, dezembro + 1 dava "2026-13" e a
    // compra desaparecia de qualquer fatura.
    expect(mesDoCiclo("2026-12-20", 5)).toBe("2027-01");
    expect(mesDoCiclo("2026-12-03", 5)).toBe("2026-12");
  });

  test("fechamento no dia 31 em fevereiro prende-se ao último dia real", () => {
    // Não existe 31 de fevereiro. O dia de fechamento tem de encolher para 28
    // (ou 29), senão nenhuma compra do mês passava do fechamento e o ciclo
    // seguinte ficava sempre vazio.
    expect(mesDoCiclo("2026-02-28", 31)).toBe("2026-02");
    // 2028 é bissexto: o fechamento cai a 29.
    expect(mesDoCiclo("2028-02-29", 31)).toBe("2028-02");
  });

  test("sem dia de fechamento, o ciclo é o mês civil da própria compra", () => {
    // Comportamento de sempre — o cartão fecha no fim do mês.
    expect(mesDoCiclo("2026-07-31")).toBe("2026-07");
    expect(mesDoCiclo("2026-07-01", 0)).toBe("2026-07");
  });

  test("a fatura de janeiro cobre dezembro do ano anterior", () => {
    expect(cicloDaFatura("2027-01")).toBe("2026-12");
  });
});

describe("despesa fixa sem dia de vencimento", () => {
  const fixa = (extra: Partial<DespesaFixa> = {}): DespesaFixa => ({
    id: "f1",
    descricao: "Ginásio",
    valor: 3000,
    categoria: "Saúde",
    contaCartao: "AB Gold (C)",
    autoDebit: true,
    pagoPorMes: {},
    ...extra,
  });

  test("no mês corrente espera o fim do mês antes de dar por paga", () => {
    // Sem dia próprio não há como saber quando sai. Supor o dia 1 afirmaria
    // que já saiu logo no primeiro dia; o fallback é o fim do mês, que erra
    // para o lado seguro (mostra como pendente algo que talvez já tenha saído,
    // em vez de mostrar como paga uma coisa que ainda não saiu).
    const f = fixa();
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-01")).toBe(false);
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-31")).toBe(true);
  });

  test("em fevereiro o fim do mês é o dia 28, não um 31 que não existe", () => {
    const f = fixa();
    expect(fixaEfetivamentePaga(f, "2026-02", "2026-02", "2026-02-28")).toBe(true);
  });

  test("mês já fechado conta como pago sem olhar ao dia", () => {
    // Junho visto de julho: não há dúvida nenhuma de que passou por inteiro.
    expect(fixaEfetivamentePaga(fixa(), "2026-06", "2026-07", "2026-07-01")).toBe(true);
  });

  test("marcada à mão conta sempre, mesmo sem dia e sem débito automático", () => {
    const f = fixa({
      autoDebit: undefined,
      contaCartao: undefined,
      pagoPorMes: { "2026-07": true },
    });
    expect(fixaEfetivamentePaga(f, "2026-07")).toBe(true);
  });

  test("sem débito automático e sem marcação, nunca se dá por paga sozinha", () => {
    // Quem paga à mão decide quando pagou — o app não pode presumir.
    const f = fixa({ autoDebit: undefined, contaCartao: undefined });
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-07", "2026-07-31")).toBe(false);
  });

  test("mês fora do plano da fixa não conta, mesmo já tendo passado", () => {
    // Uma fixa que começou em agosto não pode aparecer como paga em julho só
    // porque julho já acabou.
    const f = fixa({ inicio: "2026-08" });
    expect(fixaEfetivamentePaga(f, "2026-07", "2026-09", "2026-09-01")).toBe(false);
  });
});
