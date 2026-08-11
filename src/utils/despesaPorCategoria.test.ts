import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, DespesaFixa, Parcela } from "../types";
import {
  despesaPorCategoriaMes,
  maiorCategoriaRelevante,
  paradasDonut,
  totalDasFatias,
} from "./despesaPorCategoria";

function corrente(extra: Partial<DespesaCorrente> = {}): DespesaCorrente {
  return {
    id: "d1",
    descricao: "Compra",
    valor: 1000,
    data: "2026-07-10",
    categoria: "Alimentação",
    ...extra,
  };
}

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

const SEM_VEICULO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};

describe("despesaPorCategoriaMes", () => {
  test("agrupa por categoria e ordena da maior fatia pra menor", () => {
    const despesas = [
      corrente({ id: "d1", valor: 3000, categoria: "Alimentação" }),
      corrente({ id: "d2", valor: 1000, categoria: "Alimentação" }),
      corrente({ id: "d3", valor: 6000, categoria: "Lazer" }),
    ];
    const fatias = despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias.map((f) => [f.categoria, f.valor])).toEqual([
      ["Lazer", 6000],
      ["Alimentação", 4000],
    ]);
    expect(fatias.map((f) => f.pct)).toEqual([60, 40]);
    expect(totalDasFatias(fatias)).toBe(10000);
  });

  test("ignora outro mês, pagamento de fatura e o espelho da parcela", () => {
    const despesas = [
      corrente({ id: "d1", valor: 1000, data: "2026-06-30" }), // outro mês
      corrente({ id: "d2", valor: 5000, categoria: "Cartão", origem: "fat" }), // fatura
      corrente({ id: "d3", valor: 2000, categoria: "Compras", origem: "parc" }), // espelho
      corrente({ id: "d4", valor: 800, categoria: "Lazer" }),
    ];
    const fatias = despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Lazer", valor: 800, pct: 100 }]);
  });

  test("parcela entra pelo plano, na categoria dela — sem duplicar com o espelho", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        pagoPorMes: { "2026-07": true },
      },
    ];
    const espelho = [corrente({ id: "d1", valor: 10000, categoria: "Casa", origem: "parc" })];
    const fatias = despesaPorCategoriaMes(espelho, [], p, SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Casa", valor: 10000, pct: 100 }]);
  });

  test("mês fechado: parcela pendente entra cheia; mês corrente, não", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        pagoPorMes: {},
      },
    ];
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-09")).toEqual([
      { categoria: "Parcelas", valor: 10000, pct: 100 },
    ]);
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
  });

  // Ninguém marca uma parcela em débito automático — o botão "Pagar mês" nem
  // aparece para ela. Sem tratar isso, ela sumia do donut no mês corrente.
  test("mês corrente: parcela em débito automático entra sem marcação", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        cartao: "AB Gold (C)",
        autoDebit: true,
        pagoPorMes: {},
      },
    ];
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-07")).toEqual([
      { categoria: "Casa", valor: 10000, pct: 100 },
    ]);
  });

  test("fixa ativa entra pelo valor cheio mesmo pendente; fora da janela não entra", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, categoria: "Casa", pagoPorMes: {} }),
      fixa({ id: "f2", valor: 999, categoria: "Assinaturas", inicio: "2026-08" }),
    ];
    const fatias = despesaPorCategoriaMes([], fixas, [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Casa", valor: 45000, pct: 100 }]);
  });

  test("veículo entra como uma fatia só (cargas + despesas + fixas pagas)", () => {
    const veiculo: DadosVeiculo = {
      cargas: [
        { id: "c1", data: "2026-07-05", kwh: 30, precoKwh: 20, custo: 600, local: "Casa" },
        { id: "c2", data: "2026-06-05", kwh: 30, precoKwh: 20, custo: 600, local: "Casa" },
      ],
      despesas: [{ id: "v1", data: "2026-07-08", valor: 1500, categoria: "Portagens" }],
      despesasFixas: [
        fixa({ id: "vf1", valor: 5000, categoria: "Seguro", pagoPorMes: { "2026-07": true } }),
      ],
      quilometragem: [],
    };
    const fatias = despesaPorCategoriaMes([], [], [], veiculo, "2026-07", "2026-07");
    // 600 (carga de julho) + 1500 + 5000 — a carga de junho fica fora
    expect(fatias).toEqual([{ categoria: "Veículo", valor: 7100, pct: 100 }]);
  });

  test("mês sem nada dá lista vazia (donut mostra o estado vazio)", () => {
    expect(despesaPorCategoriaMes([], [], [], SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
    expect(totalDasFatias([])).toBe(0);
  });

  test("categoria com total zero não vira fatia", () => {
    const despesas = [corrente({ id: "d1", valor: 0, categoria: "Lazer" })];
    expect(despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
  });
});

describe("paradasDonut", () => {
  test("fatias emendam sem sobra e a última fecha em 100%", () => {
    const fatias = [
      { categoria: "Lazer", valor: 6000, pct: 60 },
      { categoria: "Casa", valor: 4000, pct: 40 },
    ];
    expect(paradasDonut(fatias, ["#a", "#b"])).toEqual([
      "#a 0.000% 60.000%",
      "#b 60.000% 100.000%",
    ]);
  });

  test("três fatias com resto de arredondamento ainda fecham em 100%", () => {
    const fatias = [
      { categoria: "A", valor: 1, pct: 33 },
      { categoria: "B", valor: 1, pct: 33 },
      { categoria: "C", valor: 1, pct: 33 },
    ];
    const paradas = paradasDonut(fatias, ["#a", "#b", "#c"]);
    expect(paradas[0]).toBe("#a 0.000% 33.333%");
    expect(paradas[2].endsWith("100.000%")).toBe(true);
  });

  test("sem fatias não gera gradiente", () => {
    expect(paradasDonut([], [])).toEqual([]);
  });
});

describe("maiorCategoriaRelevante — o que o card de Despesas mostra", () => {
  const fatia = (categoria: string, valor: number) => ({ categoria, valor, pct: 0 });

  test("ignora o veículo e a família aluguel, mesmo sendo as maiores", () => {
    const fatias = [
      fatia("Veículo", 90000),
      fatia("Casa", 80000),
      fatia("Alimentação", 42000),
      fatia("Lazer", 18000),
    ];
    expect(maiorCategoriaRelevante(fatias)?.categoria).toBe("Alimentação");
  });

  test("os sinónimos de aluguel saem todos, com ou sem acento", () => {
    for (const nome of [
      "Casa",
      "Habitação",
      "habitacao",
      "Renda",
      "Aluguer",
      "ALUGUER",
      "Aluguel", // grafia pt-BR — faltava na lista, categoria real ficava de fora
      "aluguel",
    ]) {
      expect(maiorCategoriaRelevante([fatia(nome, 90000), fatia("Lazer", 100)])?.categoria).toBe(
        "Lazer",
      );
    }
  });

  test("devolve null quando só sobram as excluídas", () => {
    expect(maiorCategoriaRelevante([fatia("Veículo", 500), fatia("Renda", 900)])).toBeNull();
    expect(maiorCategoriaRelevante([])).toBeNull();
  });

  test("mantém a ordem que já vinha (maior primeiro)", () => {
    const fatias = [fatia("Compras", 30000), fatia("Saúde", 20000)];
    expect(maiorCategoriaRelevante(fatias)?.valor).toBe(30000);
  });
});
