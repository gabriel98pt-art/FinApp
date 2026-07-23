import { describe, expect, test } from "vitest";
import type { DespesaCorrente, DespesaFixa, Parcela, Transferencia } from "../types";
import { despesasNosTotais } from "./calculos";
import {
  calcularFatura,
  calcularFaturaAutomatica,
  cicloDaFatura,
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

  test("lançamento de parcela (origem parc) CONTA nos totais — nada invisível", () => {
    const parcelaMensal = dc({ valor: 1867, origem: "parc", categoria: "Parcelas" });
    expect(despesasNosTotais([parcelaMensal])).toEqual([parcelaMensal]);
  });
});
