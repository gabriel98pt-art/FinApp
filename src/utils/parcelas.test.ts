import { describe, expect, test } from "vitest";
import type { Parcela } from "../types";
import {
  mesesDaParcela,
  mesesNaoPagos,
  parcelaQuitada,
  progressoDaParcela,
  valorDaParcela,
  valorQuitacao,
} from "./parcelas";

function parcela(extra: Partial<Parcela> = {}): Parcela {
  return {
    id: "p1",
    descricao: "TV Nova",
    total: 5599, // 55,99
    numParcelas: 3,
    primeiroMes: "2026-06",
    pagoPorMes: {},
    ...extra,
  };
}

test("mesesDaParcela cobre o plano inteiro, virando o ano", () => {
  expect(mesesDaParcela(parcela({ primeiroMes: "2026-11", numParcelas: 4 }))).toEqual([
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
});

describe("valorDaParcela — divisão exata em centavos (referência)", () => {
  test("55,99 em 3× → 18,67 + 18,66 + 18,66, resto nas primeiras", () => {
    const p = parcela();
    expect(valorDaParcela(p, "2026-06")).toBe(1867);
    expect(valorDaParcela(p, "2026-07")).toBe(1866);
    expect(valorDaParcela(p, "2026-08")).toBe(1866);
    // soma fecha exatamente o total — nenhum centavo perdido
    expect(1867 + 1866 + 1866).toBe(5599);
  });

  test("ajuste manual de um mês prevalece", () => {
    const p = parcela({ overridePorMes: { "2026-07": 2000 } });
    expect(valorDaParcela(p, "2026-07")).toBe(2000);
    expect(valorDaParcela(p, "2026-06")).toBe(1867);
  });

  test("mês fora do plano vale 0", () => {
    expect(valorDaParcela(parcela(), "2027-01")).toBe(0);
  });
});

describe("quitação antecipada (seção 4.3)", () => {
  test("soma só as parcelas em aberto", () => {
    const p = parcela({ pagoPorMes: { "2026-06": true } });
    expect(mesesNaoPagos(p)).toEqual(["2026-07", "2026-08"]);
    expect(valorQuitacao(p)).toBe(1866 + 1866);
  });

  test("tudo pago → quitação 0 e parcela quitada", () => {
    const p = parcela({ pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true } });
    expect(valorQuitacao(p)).toBe(0);
    expect(parcelaQuitada(p)).toBe(true);
  });
});

test("progresso conta pagas/total", () => {
  const p = parcela({ pagoPorMes: { "2026-06": true } });
  expect(progressoDaParcela(p)).toEqual({ pagas: 1, total: 3 });
});
