import { describe, expect, test } from "vitest";
import type { Parcela } from "../types";
import {
  contribuicaoParcelasMes,
  diaVencimentoEfetivo,
  estaEfetivamentePaga,
  mesesDaParcela,
  mesesNaoPagos,
  pagoNoMes,
  parcelaQuitada,
  progressoDaParcela,
  totalDaCompra,
  totalParcelasGeral,
  totalParcelasNoMes,
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

describe("contribuicaoParcelasMes — mesma regra das fixas (mês corrente vs. fechado)", () => {
  test("mês fechado: conta o valor cheio de todas no prazo, pagas ou não", () => {
    const paga = parcela({ id: "p1", pagoPorMes: { "2026-07": true } });
    const pendente = parcela({ id: "p2", pagoPorMes: {} });
    expect(contribuicaoParcelasMes([paga, pendente], "2026-07", "2026-09")).toBe(1866 + 1866);
  });

  test("mês corrente: só as marcadas pagas naquele mês", () => {
    const paga = parcela({ id: "p1", pagoPorMes: { "2026-07": true } });
    const pendente = parcela({ id: "p2", pagoPorMes: {} });
    expect(contribuicaoParcelasMes([paga, pendente], "2026-07", "2026-07")).toBe(1866);
  });

  test("mês corrente: pagamento marcado como 'fatura' também conta", () => {
    const p = parcela({ pagoPorMes: { "2026-07": "fatura" } });
    expect(contribuicaoParcelasMes([p], "2026-07", "2026-07")).toBe(1866);
  });

  test("parcela fora do prazo não entra em nenhum dos dois casos", () => {
    const p = parcela();
    expect(contribuicaoParcelasMes([p], "2027-01", "2027-01")).toBe(0);
    expect(contribuicaoParcelasMes([p], "2027-01", "2027-03")).toBe(0);
  });

  test("ajuste manual do mês prevalece no total", () => {
    const p = parcela({ overridePorMes: { "2026-07": 2000 } });
    expect(contribuicaoParcelasMes([p], "2026-07", "2026-09")).toBe(2000);
  });

  test("lista vazia dá 0", () => {
    expect(contribuicaoParcelasMes([], "2026-07", "2026-07")).toBe(0);
  });
});

// Os dois KPIs da tela Parcelas: o mês inteiro, e a fatia dele já resolvida.
// Ao contrário de contribuicaoParcelasMes, o "total" aqui não muda de regra no
// mês corrente — é sempre tudo o que vence no mês.
describe("totalParcelasNoMes / pagoNoMes — os KPIs da tela Parcelas", () => {
  test("o total soma paga e não paga do mesmo mês; o pago só conta a paga", () => {
    const paga = parcela({ id: "p1", pagoPorMes: { "2026-07": true } });
    const pendente = parcela({ id: "p2", pagoPorMes: {} });
    expect(totalParcelasNoMes([paga, pendente], "2026-07")).toBe(1866 + 1866);
    expect(pagoNoMes([paga, pendente], "2026-07", "2026-07")).toBe(1866);
  });

  test("no mês corrente o total continua cheio (a diferença para contribuicaoParcelasMes)", () => {
    const pendente = parcela({ pagoPorMes: {} });
    expect(totalParcelasNoMes([pendente], "2026-07")).toBe(1866);
    expect(contribuicaoParcelasMes([pendente], "2026-07", "2026-07")).toBe(0);
  });

  test("mês fora do plano não entra em nenhuma das duas", () => {
    const p = parcela();
    expect(totalParcelasNoMes([p], "2027-01")).toBe(0);
    expect(pagoNoMes([p], "2027-01", "2027-01")).toBe(0);
  });

  test("débito automático no cartão conta como pago sem marcação, até ao mês de referência", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, pagoPorMes: {} });
    expect(pagoNoMes([p], "2026-07", "2026-08")).toBe(1866);
    expect(pagoNoMes([p], "2026-07", "2026-07")).toBe(1866);
    // Mês ainda por vir: a cobrança nem entrou no cartão.
    expect(pagoNoMes([p], "2026-08", "2026-07")).toBe(0);
  });

  test("ajuste manual do mês vale nas duas", () => {
    const p = parcela({ overridePorMes: { "2026-07": 2000 }, pagoPorMes: { "2026-07": true } });
    expect(totalParcelasNoMes([p], "2026-07")).toBe(2000);
    expect(pagoNoMes([p], "2026-07", "2026-07")).toBe(2000);
  });

  test("lista vazia dá 0 nas duas", () => {
    expect(totalParcelasNoMes([], "2026-07")).toBe(0);
    expect(pagoNoMes([], "2026-07", "2026-07")).toBe(0);
  });
});

describe("totalParcelasGeral — acumulado de todos os tempos", () => {
  test("conta só os meses marcados pagos", () => {
    const p = parcela({ pagoPorMes: { "2026-06": true, "2026-07": true } });
    expect(totalParcelasGeral([p])).toBe(1867 + 1866);
  });

  test("nada pago → 0", () => {
    expect(totalParcelasGeral([parcela()])).toBe(0);
  });
});

describe("totalDaCompra — os dois modos do Registro Rápido", () => {
  test("modo total: o valor informado é o total, tal e qual", () => {
    expect(totalDaCompra(5599, 3, "total")).toBe(5599);
  });

  test("modo parcela: multiplica, e a divisão de volta é exata (sem resto)", () => {
    const total = totalDaCompra(1866, 3, "parcela");
    expect(total).toBe(5598);
    const p = parcela({ total, numParcelas: 3 });
    const meses = mesesDaParcela(p);
    expect(meses.map((m) => valorDaParcela(p, m))).toEqual([1866, 1866, 1866]);
  });

  test("no modo total com resto, as primeiras parcelas é que ficam com o centavo", () => {
    const p = parcela({ total: totalDaCompra(5599, 3, "total"), numParcelas: 3 });
    const meses = mesesDaParcela(p);
    expect(meses.map((m) => valorDaParcela(p, m))).toEqual([1867, 1866, 1866]);
  });
});

describe("parcela paga por cartão em débito automático", () => {
  const noCartao: Parcela = {
    id: "p1",
    descricao: "Portátil",
    total: 60000,
    numParcelas: 6,
    primeiroMes: "2026-05",
    cartao: "AB Gold (C)",
    autoDebit: true,
    pagoPorMes: {},
    diaVencimento: 3,
  };
  const emDinheiro: Parcela = { ...noCartao, cartao: undefined, autoDebit: false };

  test("o mês já cobrado no cartão conta como resolvido, sem esperar a fatura", () => {
    // Julho é o mês de referência: maio, junho e julho já foram ao cartão.
    expect(estaEfetivamentePaga(noCartao, "2026-07", "2026-07")).toBe(true);
    expect(progressoDaParcela(noCartao, "2026-07").pagas).toBe(3);
  });

  test("mês FUTURO continua a exigir marcação", () => {
    expect(estaEfetivamentePaga(noCartao, "2026-08", "2026-07")).toBe(false);
    expect(mesesNaoPagos(noCartao, "2026-07")).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(valorQuitacao(noCartao, "2026-07")).toBe(30000);
  });

  test("sem cartão nada é adiantado — continua tudo por marcar", () => {
    expect(estaEfetivamentePaga(emDinheiro, "2026-07", "2026-07")).toBe(false);
    expect(progressoDaParcela(emDinheiro, "2026-07").pagas).toBe(0);
    expect(valorQuitacao(emDinheiro, "2026-07")).toBe(60000);
  });

  test("sem mês de referência o comportamento é o de sempre", () => {
    // É assim que o Copiloto e o resto do app continuam a ver as parcelas.
    expect(progressoDaParcela(noCartao).pagas).toBe(0);
    expect(valorQuitacao(noCartao)).toBe(60000);
    expect(parcelaQuitada(noCartao)).toBe(false);
  });

  test("marcação manual continua a valer por cima de tudo", () => {
    const comMarca = { ...noCartao, pagoPorMes: { "2026-08": true as const } };
    expect(estaEfetivamentePaga(comMarca, "2026-08", "2026-07")).toBe(true);
  });

  test("no último mês a parcela fica quitada sozinha", () => {
    expect(parcelaQuitada(noCartao, "2026-10")).toBe(true);
  });
});

describe("diaVencimentoEfetivo", () => {
  const base: Parcela = {
    id: "p1",
    descricao: "Portátil",
    total: 60000,
    numParcelas: 6,
    primeiroMes: "2026-05",
    pagoPorMes: {},
    diaVencimento: 3,
  };

  test("em débito automático vence com a fatura do cartão, não no dia próprio", () => {
    const p = { ...base, cartao: "AB Gold (C)", autoDebit: true };
    expect(diaVencimentoEfetivo(p, { "AB Gold (C)": 15 })).toBe(15);
  });

  test("sem dia de fatura guardado, o dia próprio ainda serve", () => {
    const p = { ...base, cartao: "AB Gold (C)", autoDebit: true };
    expect(diaVencimentoEfetivo(p, {})).toBe(3);
    expect(diaVencimentoEfetivo(p, undefined)).toBe(3);
  });

  test("paga em dinheiro mantém o dia próprio mesmo com cartão configurado", () => {
    expect(diaVencimentoEfetivo(base, { "AB Gold (C)": 15 })).toBe(3);
    // Cartão sem débito automático: quem escolhe quando paga é o usuário.
    expect(diaVencimentoEfetivo({ ...base, cartao: "AB Gold (C)" }, { "AB Gold (C)": 15 })).toBe(3);
  });
});
