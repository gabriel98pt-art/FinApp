import { describe, expect, test } from "vitest";
import type { CargaEletrica, DadosVeiculo, DespesaFixa, DespesaVeiculo } from "../types";
import {
  contribuicaoFixasVeiculoMes,
  dadosDespesaDaCarga,
  kwhPeloCusto,
  precoKwhDoLocal,
  totalCargasMes,
  totalDespesasVeiculoMes,
  totalVeiculoGeral,
  totalVeiculoMes,
} from "./veiculo";

function carga(extra: Partial<CargaEletrica> = {}): CargaEletrica {
  return {
    id: "c1",
    data: "2026-07-10",
    kwh: 40,
    precoKwh: 25,
    custo: 1000,
    local: "Casa",
    ...extra,
  };
}

function despesa(extra: Partial<DespesaVeiculo> = {}): DespesaVeiculo {
  return { id: "d1", data: "2026-07-05", valor: 5000, categoria: "Manutenção", ...extra };
}

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

function veiculo(extra: Partial<DadosVeiculo> = {}): DadosVeiculo {
  return { cargas: [], despesas: [], despesasFixas: [], quilometragem: [], ...extra };
}

describe("totalCargasMes / totalDespesasVeiculoMes", () => {
  test("soma só o mês pedido", () => {
    const v = veiculo({
      cargas: [carga({ custo: 1000 }), carga({ custo: 500, data: "2026-06-01" })],
      despesas: [despesa({ valor: 3000 }), despesa({ valor: 999, data: "2026-08-01" })],
    });
    expect(totalCargasMes(v, "2026-07")).toBe(1000);
    expect(totalDespesasVeiculoMes(v, "2026-07")).toBe(3000);
  });
});

describe("contribuicaoFixasVeiculoMes — corrente parcial vs fechado total", () => {
  test("mês corrente: só conta fixas marcadas pagas", () => {
    const v = veiculo({
      despesasFixas: [
        fixa({ id: "f1", valor: 4500, pagoPorMes: { "2026-07": true } }),
        fixa({ id: "f2", valor: 2000, pagoPorMes: {} }), // ativa mas não paga
      ],
    });
    expect(contribuicaoFixasVeiculoMes(v, "2026-07", "2026-07")).toBe(4500);
  });

  test("mês corrente: fixa do veículo em débito automático conta sem marcação", () => {
    const v = veiculo({
      despesasFixas: [fixa({ valor: 4500, contaCartao: "AB Gold (C)", autoDebit: true })],
    });
    expect(contribuicaoFixasVeiculoMes(v, "2026-07", "2026-07")).toBe(4500);
  });

  test("mês fechado (passado): conta o total cheio, pago ou não", () => {
    const v = veiculo({
      despesasFixas: [
        fixa({ id: "f1", valor: 4500, pagoPorMes: {} }),
        fixa({ id: "f2", valor: 2000, pagoPorMes: {} }),
      ],
    });
    // mesReal é agosto, ym é julho → julho já fechou
    expect(contribuicaoFixasVeiculoMes(v, "2026-07", "2026-08")).toBe(6500);
  });

  test("respeita a janela inicio/fim mesmo em mês fechado", () => {
    const v = veiculo({
      despesasFixas: [fixa({ valor: 4500, inicio: "2026-08" })],
    });
    expect(contribuicaoFixasVeiculoMes(v, "2026-07", "2026-08")).toBe(0);
  });
});

describe("totalVeiculoMes — soma as 3 fontes (Parte A)", () => {
  test("cargas + despesas + fixas do mês corrente (só pagas)", () => {
    const v = veiculo({
      cargas: [carga({ custo: 1000 })],
      despesas: [despesa({ valor: 3000 })],
      despesasFixas: [fixa({ valor: 4500, pagoPorMes: { "2026-07": true } })],
    });
    expect(totalVeiculoMes(v, "2026-07", "2026-07")).toBe(1000 + 3000 + 4500);
  });

  test("veículo vazio dá zero", () => {
    expect(totalVeiculoMes(veiculo(), "2026-07", "2026-07")).toBe(0);
  });
});

describe("totalVeiculoGeral — acumulado de todos os tempos", () => {
  test("fixa conta valor × meses marcados pagos", () => {
    const v = veiculo({
      cargas: [carga({ custo: 1000 }), carga({ custo: 500, data: "2026-01-01" })],
      despesas: [despesa({ valor: 3000 })],
      despesasFixas: [
        fixa({ valor: 4500, pagoPorMes: { "2026-06": true, "2026-07": true } }), // 2 meses
        fixa({ valor: 2000, pagoPorMes: { "2026-07": false } }), // nunca marcada paga
      ],
    });
    expect(totalVeiculoGeral(v)).toBe(1000 + 500 + 3000 + 4500 * 2);
  });

  test("veículo vazio dá zero", () => {
    expect(totalVeiculoGeral(veiculo())).toBe(0);
  });

  // Ninguém marca uma fixa em débito automático — mesmo tratamento de
  // totalFixasGeral (utils/despesasFixas.ts).
  test("sem mesReferencia, débito automático não conta — comportamento antigo", () => {
    const v = veiculo({
      despesasFixas: [fixa({ valor: 4500, contaCartao: "AB Gold (C)", autoDebit: true })],
    });
    expect(totalVeiculoGeral(v)).toBe(0);
  });

  test("com mesReferencia, débito automático conta todos os meses ativos até lá", () => {
    const v = veiculo({
      despesasFixas: [
        fixa({ valor: 4500, contaCartao: "AB Gold (C)", autoDebit: true, inicio: "2026-06" }),
      ],
    });
    // junho, julho, agosto = 3 meses
    expect(totalVeiculoGeral(v, "2026-08")).toBe(4500 * 3);
  });

  test("mês marcado à mão que também é automático não conta duas vezes", () => {
    const v = veiculo({
      despesasFixas: [
        fixa({
          valor: 4500,
          contaCartao: "AB Gold (C)",
          autoDebit: true,
          inicio: "2026-07",
          pagoPorMes: { "2026-07": true },
        }),
      ],
    });
    // julho e agosto, não julho duas vezes
    expect(totalVeiculoGeral(v, "2026-08")).toBe(4500 * 2);
  });

  test("sem inicio não há por onde começar — fica só o marcado à mão", () => {
    const v = veiculo({
      despesasFixas: [
        fixa({
          valor: 4500,
          contaCartao: "AB Gold (C)",
          autoDebit: true,
          pagoPorMes: { "2026-07": true },
        }),
      ],
    });
    expect(totalVeiculoGeral(v, "2026-08")).toBe(4500);
  });
});

describe("dadosDespesaDaCarga — recarga que afinal não era recarga", () => {
  test("leva dinheiro, data, local e como se pagou", () => {
    const c = carga({
      data: "2026-08-03",
      custo: 4287,
      local: "Continente",
      contaCartao: "AB Gold (C)",
      nota: "Compras da semana",
    });
    expect(dadosDespesaDaCarga(c, "Supermercado")).toEqual({
      descricao: "Continente",
      valor: 4287,
      data: "2026-08-03",
      categoria: "Supermercado",
      contaCartao: "AB Gold (C)",
      nota: "Compras da semana",
    });
  });

  test("sem categoria escolhida cai em Outros", () => {
    expect(dadosDespesaDaCarga(carga(), "").categoria).toBe("Outros");
    expect(dadosDespesaDaCarga(carga(), "  ").categoria).toBe("Outros");
  });

  // O kWh e o preço/kWh ficam pelo caminho de propósito: a compra nunca teve
  // nenhum dos dois, foram invenção do reconhecimento automático.
  test("não leva kwh nem preço por kWh", () => {
    const d = dadosDespesaDaCarga(carga({ kwh: 40, precoKwh: 25 }), "Supermercado");
    expect(d).not.toHaveProperty("kwh");
    expect(d).not.toHaveProperty("precoKwh");
  });

  test("carga sem conta nem nota não inventa campos", () => {
    const d = dadosDespesaDaCarga(carga({ contaCartao: undefined, nota: undefined }), "Outros");
    expect(d.contaCartao).toBeUndefined();
    expect(d.nota).toBeUndefined();
  });
});

describe("precoKwhDoLocal / kwhPeloCusto — adivinhar os kWh pelo custo", () => {
  test("usa o preço do carregamento MAIS RECENTE naquele local", () => {
    const cargas = [
      carga({ id: "c1", local: "Ionity", data: "2026-05-01", precoKwh: 50 }),
      carga({ id: "c2", local: "Ionity", data: "2026-07-01", precoKwh: 60 }),
      carga({ id: "c3", local: "Ionity", data: "2026-06-01", precoKwh: 55 }),
    ];
    expect(precoKwhDoLocal(cargas, "Ionity")).toBe(60);
  });

  test("local sem histórico, local vazio e lista vazia não dão preço nenhum", () => {
    const cargas = [carga({ local: "Casa", precoKwh: 24 })];
    expect(precoKwhDoLocal(cargas, "Ionity")).toBeUndefined();
    expect(precoKwhDoLocal(cargas, "   ")).toBeUndefined();
    expect(precoKwhDoLocal([], "Casa")).toBeUndefined();
  });

  test("preço zero não serve de referência", () => {
    expect(precoKwhDoLocal([carga({ local: "Casa", precoKwh: 0 })], "Casa")).toBeUndefined();
  });

  test("o kWh sai com vírgula e três casas", () => {
    expect(kwhPeloCusto(768, 24)).toBe("32,000");
    expect(kwhPeloCusto(1000, 33)).toBe("30,303");
  });
});
