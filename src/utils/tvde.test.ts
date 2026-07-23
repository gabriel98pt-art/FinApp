import { describe, expect, test } from "vitest";
import type { SemanaTvde } from "../types";
import {
  calcularSemana,
  dadosPorMes,
  dadosPorPeriodo,
  dataPagamentoDaSemana,
  fimDaSemana,
  inicioDaSemana,
  mesDePagamento,
  periodoDaSemana,
  rotuloDaSemana,
  semanaDeHoje,
  totaisPerformance,
} from "./tvde";

const INICIO = "2026-03-02"; // segunda-feira de referência do app de origem

function semana(extra: Partial<SemanaTvde> = {}): SemanaTvde {
  return {
    fat: 50000,
    port: 2000,
    alu: 26000,
    recF: 1500,
    extra: 0,
    gorj: 0,
    recP: 3000,
    horas: 40,
    viag: 50,
    pct: 6,
    ...extra,
  };
}

describe("datas de semana", () => {
  test("semana 1 = 02/03 a 08/03; semana 2 começa 09/03", () => {
    expect(inicioDaSemana(INICIO, 1).getDate()).toBe(2);
    expect(fimDaSemana(INICIO, 1).getDate()).toBe(8);
    expect(inicioDaSemana(INICIO, 2).getDate()).toBe(9);
    expect(rotuloDaSemana(INICIO, 1)).toBe("02/03 – 08/03");
  });

  test("pagamento é a segunda seguinte; mês de pagamento = mês de início+7d", () => {
    expect(dataPagamentoDaSemana(INICIO, 1)).toBe("2026-03-09");
    expect(mesDePagamento(INICIO, 1)).toBe("2026-03");
    // semana 5 começa 30/03 → +7d = 06/04 → paga em abril
    expect(inicioDaSemana(INICIO, 5).getDate()).toBe(30);
    expect(mesDePagamento(INICIO, 5)).toBe("2026-04");
  });

  test("período de 4 semanas e semana de hoje", () => {
    expect(periodoDaSemana(4)).toBe(1);
    expect(periodoDaSemana(5)).toBe(2);
    expect(semanaDeHoje(INICIO, new Date(2026, 2, 2))).toBe(1);
    expect(semanaDeHoje(INICIO, new Date(2026, 2, 8))).toBe(1);
    expect(semanaDeHoje(INICIO, new Date(2026, 2, 9))).toBe(2);
  });
});

describe("calcularSemana — fórmula da planilha (NÃO mudar)", () => {
  test("valores exatos", () => {
    const c = calcularSemana(semana({ extra: 500 }), 6);
    expect(c.frota).toBe(3000); // 50000 × 6%
    expect(c.receita).toBe(17500); // 50000 − 3000 − 2000 − 26000 − 1500
    expect(c.lucro).toBe(15000); // 17500 − 3000 + 500
    expect(c.custos).toBe(35500); // 3000+2000+26000+1500+3000
    expect(c.ganhosPorHora).toBe(375); // 15000/40
    expect(c.eurPorViagem).toBe(300); // 15000/50
    expect(c.pctCusto).toBeCloseTo(0.71); // 35500/50000
  });

  test("gorjetas NUNCA entram no lucro", () => {
    const sem = calcularSemana(semana(), 6);
    const com = calcularSemana(semana({ gorj: 70000 }), 6);
    expect(com.lucro).toBe(sem.lucro);
  });

  test("pct da PRÓPRIA semana prevalece sobre o padrão da config", () => {
    expect(calcularSemana(semana({ pct: 10 }), 6).frota).toBe(5000);
  });

  test("sem horas/viagens/faturamento → null, não divisão por zero", () => {
    const c = calcularSemana(semana({ fat: 0, horas: 0, viag: 0 }), 6);
    expect(c.ganhosPorHora).toBeNull();
    expect(c.eurPorViagem).toBeNull();
    expect(c.pctCusto).toBeNull();
  });
});

describe("semana de TESTE: performance ignora, dinheiro real não (seção 4.4)", () => {
  // semanas 1 e 2 pagam ambas em março (início+7d dentro de março)
  const semanas = {
    "1": semana(), // normal — lucro 14500
    "2": semana({ teste: true }), // teste — lucro 14500
  };

  test("agregado de performance só reflete a semana normal", () => {
    const t = totaisPerformance(semanas, {}, INICIO, 6);
    expect(t.n).toBe(1);
    expect(t.lucro).toBe(14500);
    expect(t.mediaSemana).toBe(14500);
    expect(t.melhor).toEqual({ n: 1, lucro: 14500 });
  });

  test("agregado mensal soma as duas (dinheiro real)", () => {
    const meses = dadosPorMes(semanas, {}, INICIO, 6);
    expect(meses).toHaveLength(1);
    expect(meses[0].mes).toBe("2026-03");
    expect(meses[0].lucro).toBe(29000);
  });

  test("agregado por período também soma as duas", () => {
    const periodos = dadosPorPeriodo(semanas, 6);
    expect(periodos).toHaveLength(1);
    expect(periodos[0].lucro).toBe(29000);
    expect(periodos[0].fat).toBe(100000);
  });
});

describe("Segurança Social por mês de pagamento", () => {
  test("só desconta meses que têm semana com faturamento", () => {
    const semanas = { "1": semana() }; // paga em março
    const seg = { "2026-03": 5000, "2026-07": 9999 }; // julho não tem semana
    const t = totaisPerformance(semanas, seg, INICIO, 6);
    expect(t.segTotal).toBe(5000);
    expect(t.lucroLiquido).toBe(14500 - 5000);
  });

  test("semana de teste também valida o mês para o desconto (dinheiro real)", () => {
    const semanas = { "1": semana({ teste: true }) };
    const t = totaisPerformance(semanas, { "2026-03": 5000 }, INICIO, 6);
    expect(t.lucro).toBe(0); // performance ignora a semana teste
    expect(t.segTotal).toBe(5000); // mas o mês dela existe para a Seg. Social
  });

  test("visão mensal: líquido = lucro − seg do mês", () => {
    const semanas = { "1": semana(), "5": semana() }; // março e abril
    const meses = dadosPorMes(semanas, { "2026-03": 5000 }, INICIO, 6);
    const marco = meses.find((m) => m.mes === "2026-03")!;
    const abril = meses.find((m) => m.mes === "2026-04")!;
    expect(marco.seg).toBe(5000);
    expect(marco.liquido).toBe(14500 - 5000);
    expect(abril.seg).toBe(0);
    expect(abril.liquido).toBe(14500);
  });
});

describe("média das últimas 4 vs 4 anteriores (só não-teste)", () => {
  test("media4/prev4", () => {
    const semanas: Record<string, SemanaTvde> = {};
    // 8 semanas: lucros 14500 cada, mas as 4 últimas com extra +1000
    for (let n = 1; n <= 8; n++) {
      semanas[String(n)] = semana(n > 4 ? { extra: 1000 } : {});
    }
    const t = totaisPerformance(semanas, {}, INICIO, 6);
    expect(t.media4).toBe(15500);
    expect(t.prev4).toBe(14500);
  });
});
