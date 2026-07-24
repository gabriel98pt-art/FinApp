import { describe, expect, test } from "vitest";
import type { CargaEletrica, DadosVeiculo, DespesaFixa, DespesaVeiculo } from "../types";
import {
  contribuicaoFixasVeiculoMes,
  totalCargasMes,
  totalDespesasVeiculoMes,
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
