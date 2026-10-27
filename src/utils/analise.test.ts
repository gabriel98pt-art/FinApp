import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, DespesaFixa, Receita, Transferencia } from "../types";
import { analisarMes, primeiroMesDeDados, type DadosAnalise } from "./analise";
import { mediaDeMeses, receitasNosTotais, totalDoMes } from "./calculos";
import { calcularMetaMensal, taxaPoupanca } from "./metas";
import { despesaRegistradaMes, resultadoDoMes } from "./resumoMensal";

const VAZIO_VEICULO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};
const HOJE = "2026-10-27";
const MES_REAL = "2026-10";
const CFG = { diaInicioSemana: 1 };

const rec = (id: string, data: string, valor: number): Receita => ({
  id,
  descricao: `Receita ${id}`,
  valor,
  data,
  fonte: "Trabalho",
});
const desp = (
  id: string,
  data: string,
  valor: number,
  categoria = "Mercado",
  extra: Partial<DespesaCorrente> = {},
): DespesaCorrente => ({ id, descricao: `Gasto ${id}`, valor, data, categoria, ...extra });

function dados(parcial: Partial<DadosAnalise> = {}): DadosAnalise {
  return {
    receitas: [],
    despesasCorrentes: [],
    despesasFixas: [],
    parcelas: [],
    transferencias: [],
    veiculo: VAZIO_VEICULO,
    ...parcial,
  };
}

// Julho a outubro: receita de 2.000 por mês (e 500 extra em outubro) e despesas
// que sobem em outubro.
const D: DadosAnalise = dados({
  receitas: [
    rec("r7", "2026-07-01", 200000),
    rec("r8", "2026-08-01", 200000),
    rec("r9", "2026-09-01", 200000),
    rec("r10", "2026-10-01", 200000),
    rec("r10b", "2026-10-15", 50000),
  ],
  despesasCorrentes: [
    desp("d7", "2026-07-10", 100000, "Casa"),
    desp("d8", "2026-08-10", 110000, "Casa"),
    desp("d9", "2026-09-10", 90000, "Casa"),
    desp("d10a", "2026-10-02", 120000, "Casa"),
    desp("d10b", "2026-10-09", 30000, "Mercado"),
    desp("d10c", "2026-10-20", 8000, "Restaurante"),
    desp("d10d", "2026-10-24", 25000, "Mercado"),
  ],
});

describe("analisarMes — os números são os do resto do app", () => {
  test("receitas e despesas do mês são as do 'Resultado do mês' da Início", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    // A conta que a Início fazia antes de ser extraída, escrita à mão.
    const receitas = totalDoMes(receitasNosTotais(D.receitas), "2026-10");
    const despesas = despesaRegistradaMes(
      D.despesasCorrentes,
      D.despesasFixas,
      D.veiculo,
      "2026-10",
      MES_REAL,
      HOJE,
    );
    const atual = a.meses[a.meses.length - 1];
    expect(atual.receitas).toBe(receitas);
    expect(atual.despesas).toBe(despesas);
    expect(atual.saldo).toBe(receitas - despesas);
    expect(
      resultadoDoMes(
        D.receitas,
        D.despesasCorrentes,
        D.despesasFixas,
        D.veiculo,
        "2026-10",
        MES_REAL,
        HOJE,
      ),
    ).toEqual({ receitas, despesas, saldo: receitas - despesas });
  });

  test("a taxa de poupança é a fórmula do KPI de Planejamento", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    const atual = a.meses[a.meses.length - 1];
    expect(a.taxa.atual).toBe(taxaPoupanca(atual.receitas, atual.saldo));
    // 2.500 de receita, 1.830 de despesa: sobram 670 = 27%.
    expect(a.taxa.atual).toBe(27);
    expect(a.taxa.guardou).toBe(67000);
    expect(a.taxa.receitas).toBe(250000);
  });

  test("a taxa de poupança é a mesma de Planejamento → Metas (mesmo critério: fluxo de caixa)", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    const meta = calcularMetaMensal(
      D.receitas,
      D.despesasCorrentes,
      D.despesasFixas,
      D.veiculo,
      "2026-10",
      MES_REAL,
      27,
      50000,
      HOJE,
    );
    expect(taxaPoupanca(meta.receitas, meta.saldo)).toBe(a.taxa.atual);
    expect(meta.saldo).toBe(a.meses[a.meses.length - 1].saldo);
  });

  test("a taxa média é a média das taxas mensais da janela", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    // jul 50%, ago 45%, set 55%, out 27%.
    expect(a.meses.map((p) => p.taxa)).toEqual([50, 45, 55, 27]);
    expect(a.taxa.media).toBe(44);
  });
});

describe("analisarMes — mês atual contra a média dos meses antes", () => {
  test("usa a média dos meses ANTES do atual, como o 'Média (3 meses)'", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 3);
    const antes = mediaDeMeses(["2026-07", "2026-08", "2026-09"], "2026-07", (m) =>
      despesaRegistradaMes(D.despesasCorrentes, D.despesasFixas, D.veiculo, m, MES_REAL, HOJE),
    );
    expect(a.vsMedia.despesas.media).toBe(antes?.media);
    expect(a.vsMedia.despesas.media).toBe(100000);
    expect(a.mesesNaMedia).toBe(3);
  });

  test("despesa que sobe é pior; receita que sobe é melhor", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 3);
    expect(a.vsMedia.despesas).toMatchObject({ atual: 183000, pct: 83, pior: true });
    expect(a.vsMedia.receitas).toMatchObject({
      atual: 250000,
      media: 200000,
      pct: 25,
      pior: false,
    });
    // sobra: 670 contra a média de 1.000 → desceu 33%, e para a sobra descer é pior.
    expect(a.vsMedia.sobra).toMatchObject({ atual: 67000, media: 100000, pct: -33, pior: true });
  });

  test("sem variação não há veredicto", () => {
    const parado = dados({
      receitas: [rec("a", "2026-09-01", 100000), rec("b", "2026-10-01", 100000)],
      despesasCorrentes: [desp("c", "2026-09-05", 50000), desp("d", "2026-10-05", 50000)],
    });
    const a = analisarMes(parado, CFG, "2026-10", MES_REAL, HOJE, 3);
    expect(a.vsMedia.despesas).toMatchObject({ pct: 0, pior: null });
  });

  test("a média ignora os meses antes de haver história", () => {
    // Só há dados de setembro em diante: pedir 12 meses não dilui a média com zeros.
    const curto = dados({
      receitas: [rec("a", "2026-09-01", 100000), rec("b", "2026-10-01", 100000)],
      despesasCorrentes: [desp("c", "2026-09-05", 40000), desp("d", "2026-10-05", 60000)],
    });
    const a = analisarMes(curto, CFG, "2026-10", MES_REAL, HOJE, 12);
    expect(a.meses.map((p) => p.mes)).toEqual(["2026-09", "2026-10"]);
    expect(a.vsMedia.despesas.media).toBe(40000);
    expect(a.mesesNaMedia).toBe(1);
  });
});

describe("analisarMes — casos de borda", () => {
  test("sem dados nenhuns: estado vazio", () => {
    const a = analisarMes(dados(), CFG, "2026-10", MES_REAL, HOJE, 6);
    expect(a.vazio).toBe(true);
    expect(a.meses).toEqual([]);
  });

  test("mês anterior ao primeiro dado: estado vazio", () => {
    expect(analisarMes(D, CFG, "2026-05", MES_REAL, HOJE, 6).vazio).toBe(true);
  });

  test("receita zero: a taxa é nula (não NaN nem infinita) e a média ignora esse mês", () => {
    const semReceita = dados({
      receitas: [rec("a", "2026-09-01", 100000)],
      despesasCorrentes: [desp("c", "2026-09-05", 40000), desp("d", "2026-10-05", 60000)],
    });
    const a = analisarMes(semReceita, CFG, "2026-10", MES_REAL, HOJE, 3);
    expect(a.taxa.atual).toBeNull();
    expect(a.meses[1].taxa).toBeNull();
    expect(a.taxa.media).toBe(60); // só setembro tinha receita
    expect(Number.isFinite(a.taxa.guardou)).toBe(true);
    expect(a.vsMedia.receitas).toMatchObject({ media: 100000, pct: -100, pior: true });
  });

  test("a média a zero não dá percentagem", () => {
    const a = analisarMes(
      dados({ receitas: [rec("a", "2026-10-01", 1000)] }),
      CFG,
      "2026-10",
      MES_REAL,
      HOJE,
      3,
    );
    expect(a.vsMedia.despesas.media).toBeNull();
    expect(a.vsMedia.despesas.pct).toBeNull();
  });

  test("período maior do que o histórico: só os meses que existem", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 12);
    expect(a.meses.map((p) => p.mes)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  test("só um mês de dados: não quebra, sem média", () => {
    const um = dados({
      receitas: [rec("a", "2026-10-01", 100000)],
      despesasCorrentes: [desp("c", "2026-10-05", 25000)],
    });
    const a = analisarMes(um, CFG, "2026-10", MES_REAL, HOJE, 6);
    expect(a.vazio).toBe(false);
    expect(a.meses).toHaveLength(1);
    expect(a.vsMedia.despesas.pct).toBeNull();
    expect(a.categorias[0]).toMatchObject({ categoria: "Mercado", pct: null });
  });
});

describe("analisarMes — semanas, categorias e maiores gastos", () => {
  test("as semanas somam o que se gastou no mês", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    const soma = a.semanas.barras.reduce((s, b) => s + b.valor, 0);
    expect(soma).toBe(120000 + 30000 + 8000 + 25000);
  });

  test("a semana de hoje é a atual e as seguintes são futuras", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    // 27/10/2026 é uma terça: a semana de 26/10 a 01/11 (a última do grid).
    const estados = a.semanas.barras.map((b) => b.estado);
    expect(estados[estados.length - 1]).toBe("atual");
    expect(estados.filter((e) => e === "atual")).toHaveLength(1);
    expect(estados.slice(0, -1).every((e) => e === "passada")).toBe(true);
  });

  test("a média semanal conta só as semanas que já começaram", () => {
    const a = analisarMes(D, CFG, "2026-10", "2026-10", "2026-10-10", 6);
    expect(a.semanas.barras.some((b) => b.estado === "futura")).toBe(true);
    const comecadas = a.semanas.barras.filter((b) => b.estado !== "futura");
    expect(a.semanas.media).toBe(
      Math.round(comecadas.reduce((s, b) => s + b.valor, 0) / comecadas.length),
    );
  });

  test("categorias: as maiores do mês, com a série da janela e a variação", () => {
    const a = analisarMes(D, CFG, "2026-10", MES_REAL, HOJE, 6);
    expect(a.categorias.map((c) => c.categoria)).toEqual(["Casa", "Mercado", "Restaurante"]);
    const casa = a.categorias[0];
    expect(casa.serie).toEqual([100000, 110000, 90000, 120000]);
    // média antes: 100.000 → +20%, e gasto a subir é pior.
    expect(casa).toMatchObject({ atual: 120000, pct: 20, pior: true });
    // Mercado só existe em outubro: a média dos meses antes é 0 → sem percentagem.
    expect(a.categorias[1]).toMatchObject({ categoria: "Mercado", pct: null });
  });

  test("maiores gastos: os 3 maiores, sem transferências nem pagamentos de fatura", () => {
    const comRuido: DadosAnalise = {
      ...D,
      despesasCorrentes: [
        ...D.despesasCorrentes,
        desp("fat", "2026-10-12", 999999, "Cartão", { origem: "fat" }),
      ],
      transferencias: [
        {
          id: "t1",
          data: "2026-10-13",
          valor: 888888,
          de: "A",
          para: "B",
          descricao: "",
        } as Transferencia,
      ],
    };
    const a = analisarMes(comRuido, CFG, "2026-10", MES_REAL, HOJE, 6);
    expect(a.maioresGastos.map((g) => g.valor)).toEqual([120000, 30000, 25000]);
  });
});

describe("primeiroMesDeDados", () => {
  test("o mais antigo entre receitas e despesas", () => {
    expect(primeiroMesDeDados(D)).toBe("2026-07");
  });

  test("uma fixa sem início não conta como 'desde sempre'", () => {
    const fixa: DespesaFixa = {
      id: "f",
      descricao: "Netflix",
      valor: 1599,
      categoria: "Assinaturas",
      pagoPorMes: {},
    };
    expect(primeiroMesDeDados(dados({ despesasFixas: [fixa] }))).toBeNull();
  });

  test("sem dados é nulo", () => {
    expect(primeiroMesDeDados(dados())).toBeNull();
  });
});
