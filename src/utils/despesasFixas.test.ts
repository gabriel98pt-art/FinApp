import { describe, expect, test } from "vitest";
import type { DespesaFixa } from "../types";
import { contribuicaoFixasMes, totalFixasGeral } from "./despesasFixas";

function fixa(extra: Partial<DespesaFixa> = {}): DespesaFixa {
  return {
    id: "f1",
    descricao: "Aluguel",
    valor: 45000,
    categoria: "Casa",
    pagoPorMes: {},
    ...extra,
  };
}

describe("contribuicaoFixasMes — corrente parcial vs fechado total", () => {
  test("mês corrente: só conta fixas marcadas pagas", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, pagoPorMes: { "2026-07": true } }),
      fixa({ id: "f2", valor: 999, pagoPorMes: {} }), // ativa mas não paga
    ];
    expect(contribuicaoFixasMes(fixas, "2026-07", "2026-07")).toBe(45000);
  });

  test("mês fechado (passado): conta o total cheio, pago ou não", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, pagoPorMes: {} }),
      fixa({ id: "f2", valor: 999, pagoPorMes: {} }),
    ];
    // mesReal é agosto → julho já fechou
    expect(contribuicaoFixasMes(fixas, "2026-07", "2026-08")).toBe(45999);
  });

  // Ninguém marca uma fixa em débito automático — a promessa é não ter de mexer.
  test("mês corrente: fixa em débito automático no cartão conta sem marcação", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, contaCartao: "AB Gold (C)", autoDebit: true }),
      fixa({ id: "f2", valor: 999, pagoPorMes: {} }), // sem cartão: continua a precisar
    ];
    expect(contribuicaoFixasMes(fixas, "2026-07", "2026-07")).toBe(45000);
  });

  test("respeita a janela inicio/fim mesmo em mês fechado", () => {
    const fixas = [fixa({ valor: 45000, inicio: "2026-08" })];
    expect(contribuicaoFixasMes(fixas, "2026-07", "2026-08")).toBe(0);
  });

  test("sem fixas dá zero", () => {
    expect(contribuicaoFixasMes([], "2026-07", "2026-07")).toBe(0);
  });
});

describe("totalFixasGeral — acumulado de todos os tempos", () => {
  test("fixa conta valor × meses marcados pagos", () => {
    const fixas = [
      fixa({ valor: 45000, pagoPorMes: { "2026-06": true, "2026-07": true } }), // 2 meses
      fixa({ id: "f2", valor: 999, pagoPorMes: { "2026-07": false } }), // nunca marcada paga
    ];
    expect(totalFixasGeral(fixas)).toBe(45000 * 2);
  });

  test("sem fixas dá zero", () => {
    expect(totalFixasGeral([])).toBe(0);
  });
});

describe("totalFixasGeral com fixa em débito automático", () => {
  const CARTAO = "AB Gold (C)";

  test("conta todos os meses do plano até hoje, sem marcação nenhuma", () => {
    const f = fixa({ valor: 4500, contaCartao: CARTAO, autoDebit: true, inicio: "2026-05" });
    // maio, junho, julho, agosto = 4 meses
    expect(totalFixasGeral([f], "2026-08")).toBe(4500 * 4);
  });

  test("para no `fim` quando ele já passou", () => {
    const f = fixa({
      valor: 4500,
      contaCartao: CARTAO,
      autoDebit: true,
      inicio: "2026-05",
      fim: "2026-06",
    });
    expect(totalFixasGeral([f], "2026-08")).toBe(4500 * 2);
  });

  test("mês marcado à mão que também é automático não conta duas vezes", () => {
    const f = fixa({
      valor: 4500,
      contaCartao: CARTAO,
      autoDebit: true,
      inicio: "2026-07",
      pagoPorMes: { "2026-07": true },
    });
    // julho e agosto, não julho duas vezes
    expect(totalFixasGeral([f], "2026-08")).toBe(4500 * 2);
  });

  test("sem `inicio` não há por onde começar — fica só o marcado à mão", () => {
    const f = fixa({
      valor: 4500,
      contaCartao: CARTAO,
      autoDebit: true,
      pagoPorMes: { "2026-07": true },
    });
    expect(totalFixasGeral([f], "2026-08")).toBe(4500);
  });

  test("sem mês de referência nada muda em relação ao cálculo antigo", () => {
    const f = fixa({
      valor: 4500,
      contaCartao: CARTAO,
      autoDebit: true,
      inicio: "2026-05",
      pagoPorMes: { "2026-07": true },
    });
    expect(totalFixasGeral([f])).toBe(4500);
  });

  test("sem cartão, ou sem autoDebit, continua a valer só a marcação", () => {
    const semCartao = fixa({ valor: 4500, autoDebit: true, inicio: "2026-05" });
    const semAuto = fixa({ valor: 4500, contaCartao: CARTAO, inicio: "2026-05" });
    expect(totalFixasGeral([semCartao], "2026-08")).toBe(0);
    expect(totalFixasGeral([semAuto], "2026-08")).toBe(0);
  });
});
