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

// O bug: uma parcela em débito automático que vence dia 27 aparecia como paga
// já no dia 1 do mês, só porque o mês tinha começado — datada no futuro no
// extrato de Transações. `hoje` dá precisão de dia ao mês corrente.
describe("estaEfetivamentePaga — precisão de dia no mês corrente (com `hoje`)", () => {
  test("sem `hoje`, mês inteiro conta desde o dia 1 — comportamento antigo", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, diaVencimento: 27 });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07")).toBe(true);
  });

  test("com `hoje`, não conta antes do dia de vencimento", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, diaVencimento: 27 });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-08")).toBe(false);
  });

  test("com `hoje`, conta assim que o dia de vencimento chega ou passa", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, diaVencimento: 27 });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-27")).toBe(true);
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-28")).toBe(true);
  });

  test("mês inteiramente fechado conta mesmo com `hoje` cedo no mês seguinte", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, diaVencimento: 27 });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-08", "2026-08-01")).toBe(true);
  });

  test("sem diaVencimento, espera o fim do mês em vez de supor o dia 1", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-15")).toBe(false);
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-31")).toBe(true);
  });

  test("marcada à mão conta sempre, `hoje` ou não", () => {
    const p = parcela({ pagoPorMes: { "2026-07": true } });
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-01")).toBe(true);
  });
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

  // Ninguém marca uma parcela em débito automático — o botão "Pagar mês" nem
  // aparece para ela. Sem isto, o mês corrente ficava sempre de fora do total.
  test("mês corrente: parcela em débito automático conta sem marcação", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, pagoPorMes: {} });
    expect(contribuicaoParcelasMes([p], "2026-07", "2026-07")).toBe(1866);
  });

  test("com `hoje`, débito automático só entra depois do dia de vencimento", () => {
    const p = parcela({
      cartao: "AB Gold (C)",
      autoDebit: true,
      diaVencimento: 27,
      pagoPorMes: {},
    });
    expect(contribuicaoParcelasMes([p], "2026-07", "2026-07", "2026-07-08")).toBe(0);
    expect(contribuicaoParcelasMes([p], "2026-07", "2026-07", "2026-07-27")).toBe(1866);
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

  test("sem mesReferencia, débito automático não conta — comportamento antigo", () => {
    const p = parcela({ cartao: "AB Gold (C)", autoDebit: true, pagoPorMes: {} });
    expect(totalParcelasGeral([p])).toBe(0);
  });

  // O plano da parcela é sempre finito (ao contrário da fixa em aberto), então
  // não há o problema de "não saber até onde recuar": com mesReferencia, todo
  // mês do plano até lá conta, mesmo sem marcação nenhuma.
  test("com mesReferencia, débito automático conta todos os meses do plano até lá", () => {
    const p = parcela({
      cartao: "AB Gold (C)",
      autoDebit: true,
      primeiroMes: "2026-06",
      numParcelas: 3,
      pagoPorMes: {},
    });
    // junho + julho, agosto ainda não chegou
    expect(totalParcelasGeral([p], "2026-07")).toBe(1867 + 1866);
  });

  test("mês marcado à mão que também é automático não conta duas vezes", () => {
    const p = parcela({
      cartao: "AB Gold (C)",
      autoDebit: true,
      primeiroMes: "2026-06",
      numParcelas: 3,
      pagoPorMes: { "2026-06": true },
    });
    expect(totalParcelasGeral([p], "2026-07")).toBe(1867 + 1866);
  });

  // O bug: o mês corrente (mesReferencia) contava sempre como já resolvido,
  // mesmo antes do dia de vencimento — mesma precisão de dia que
  // estaEfetivamentePaga já tinha, mas que faltava chegar até aqui.
  test("com `hoje`, o mês corrente só entra depois do dia de vencimento", () => {
    const p = parcela({
      cartao: "AB Gold (C)",
      autoDebit: true,
      diaVencimento: 27,
      primeiroMes: "2026-06",
      numParcelas: 3,
      pagoPorMes: {},
    });
    // junho já fechado; julho (corrente) ainda não venceu
    expect(totalParcelasGeral([p], "2026-07", "2026-07-08")).toBe(1867);
    // julho já venceu
    expect(totalParcelasGeral([p], "2026-07", "2026-07-27")).toBe(1867 + 1866);
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

// ---------------------------------------------------------------------------
// Casos de borda: virada de ano, resto de centavos e quitação antecipada.
// ---------------------------------------------------------------------------

describe("virada de mês e de ano", () => {
  test("uma parcela iniciada em novembro atravessa o ano sem saltar meses", () => {
    // O caso real: compra de Natal em 4×. Se `somarMeses` tratasse o mês como
    // número simples, dezembro + 1 dava "2026-13" em vez de "2027-01" — e a
    // parcela de janeiro nunca aparecia em lado nenhum.
    const p = parcela({ primeiroMes: "2026-11", numParcelas: 4, total: 40000 });
    expect(mesesDaParcela(p)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  test("uma parcela de 14× cobre um ano inteiro e mais dois meses", () => {
    const p = parcela({ primeiroMes: "2026-12", numParcelas: 14, total: 140000 });
    const meses = mesesDaParcela(p);
    expect(meses).toHaveLength(14);
    expect(meses[0]).toBe("2026-12");
    expect(meses[1]).toBe("2027-01"); // a virada
    expect(meses[13]).toBe("2028-01"); // a virada seguinte
    // Sem meses repetidos: uma soma errada de ano daria dois "2027-01".
    expect(new Set(meses).size).toBe(14);
  });

  test("o mês de referência que atravessa o ano ainda conta como passado", () => {
    // Em janeiro de 2027, uma parcela de dezembro de 2026 já venceu. Comparar
    // "2026-12" com "2027-01" só funciona porque o formato é ordenável como
    // texto — se o ano ficasse depois do mês, dezembro pareceria futuro.
    const p = parcela({ primeiroMes: "2026-12", numParcelas: 2, total: 20000 });
    expect(mesesNaoPagos(p, "2027-01")).toEqual(["2026-12", "2027-01"]);
  });
});

describe("resto de centavos quando o total não divide certo", () => {
  test("a soma das parcelas é sempre EXACTAMENTE o total da compra", () => {
    // O invariante que interessa: o cliente não pode pagar um cêntimo a mais
    // nem a menos do que comprou por causa de arredondamento. Vale para
    // qualquer combinação, não só para o 55,99 em 3× do exemplo.
    for (const total of [5599, 10000, 10001, 33333, 1, 99999, 7]) {
      for (const numParcelas of [2, 3, 6, 7, 12]) {
        const p = parcela({ total, numParcelas });
        const soma = mesesDaParcela(p).reduce((s, m) => s + valorDaParcela(p, m), 0);
        expect(soma, `${total} em ${numParcelas}×`).toBe(total);
      }
    }
  });

  test("o resto vai às PRIMEIRAS parcelas, não às últimas", () => {
    // 55,99 em 3× = 18,66 com resto 1 → a primeira leva o cêntimo a mais.
    // Importa que seja a primeira: é a convenção do app de referência, e quem
    // confere o extrato do cartão compara logo a primeira linha.
    const p = parcela({ total: 5599, numParcelas: 3 });
    const valores = mesesDaParcela(p).map((m) => valorDaParcela(p, m));
    expect(valores).toEqual([1867, 1866, 1866]);
  });

  test("total menor que o número de parcelas não gera parcela negativa", () => {
    // 3 cêntimos em 5× — absurdo, mas o formulário aceita. As duas primeiras
    // levam 1 cêntimo e as outras ficam a zero; nenhuma pode ficar negativa,
    // senão a compra passava a devolver dinheiro.
    const p = parcela({ total: 3, numParcelas: 5 });
    const valores = mesesDaParcela(p).map((m) => valorDaParcela(p, m));
    expect(valores.reduce((s, v) => s + v, 0)).toBe(3);
    expect(valores.every((v) => v >= 0)).toBe(true);
  });

  test("quitar no meio cobra o resto certo, sem perder o cêntimo do resto", () => {
    // Paga a 1.ª (18,67) e quita as outras duas: 55,99 − 18,67 = 37,32.
    const p = parcela({ total: 5599, numParcelas: 3, pagoPorMes: { "2026-06": true } });
    expect(valorQuitacao(p, "2026-06")).toBe(3732);
    expect(valorDaParcela(p, "2026-06") + valorQuitacao(p, "2026-06")).toBe(5599);
  });
});

describe("quitação antecipada de parcela em débito automático", () => {
  const auto = () =>
    parcela({
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      cartao: "AB Gold (C)",
      autoDebit: true,
    });

  test("os meses já vencidos contam como pagos sem ninguém ter marcado nada", () => {
    // É o que distingue autoDebit. Sem `hoje`, o mês de referência conta
    // INTEIRO: em julho, junho e julho já saíram do cartão, e só agosto fica.
    expect(mesesNaoPagos(auto(), "2026-07")).toEqual(["2026-08"]);
    expect(progressoDaParcela(auto(), "2026-07").pagas).toBe(2);
  });

  test("quitar antecipado cobra só o que ainda não saiu do cartão", () => {
    // Em julho, com o mês contado inteiro: sobra agosto, 100,00. Cobrar os
    // 300,00 da compra significaria pagar junho e julho outra vez.
    expect(valorQuitacao(auto(), "2026-07")).toBe(10000);
  });

  test("com `hoje`, o mês corrente só conta depois do dia de vencimento", () => {
    // A diferença que importa: no dia 8 de julho, a parcela que vence dia 27
    // AINDA NÃO saiu do cartão — quitar tem de a cobrar. Sem esta precisão de
    // dia, o app dava a parcela por paga três semanas antes de o dinheiro sair.
    const p = { ...auto(), diaVencimento: 27 };
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-08")).toBe(false);
    expect(estaEfetivamentePaga(p, "2026-07", "2026-07", "2026-07-27")).toBe(true);
    // Junho está fechado por inteiro: o dia não interessa.
    expect(estaEfetivamentePaga(p, "2026-06", "2026-07", "2026-07-08")).toBe(true);
  });

  test("sem diaVencimento, o mês corrente espera o fim do mês", () => {
    // Fallback documentado (dia 31, preso ao último dia real pelo diaDoMes):
    // mais seguro dar por sair no fim do mês do que supor o dia 1 e afirmar
    // que já saiu quando ainda faltam trinta dias.
    const p = auto(); // sem diaVencimento
    expect(estaEfetivamentePaga(p, "2026-06", "2026-06", "2026-06-01")).toBe(false);
    expect(estaEfetivamentePaga(p, "2026-06", "2026-06", "2026-06-30")).toBe(true);
  });

  test("em fevereiro o fim do mês é o dia 28, não um dia 31 inexistente", () => {
    // Se o fallback formatasse "2026-02-31" à letra, a comparação com a data
    // de hoje nunca dava verdade e a parcela ficava por pagar o mês inteiro.
    const p = { ...auto(), primeiroMes: "2026-02" };
    expect(estaEfetivamentePaga(p, "2026-02", "2026-02", "2026-02-28")).toBe(true);
  });

  test("quitar antes da primeira parcela cobra a compra inteira", () => {
    // Em maio nada venceu ainda, portanto não há nada já debitado a descontar.
    expect(valorQuitacao(auto(), "2026-05")).toBe(30000);
  });

  test("a quitação nunca cobra mais do que o total da compra", () => {
    for (const ref of ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
      expect(valorQuitacao(auto(), ref)).toBeLessThanOrEqual(30000);
    }
  });

  test("depois do último mês vencido não há nada a quitar", () => {
    expect(valorQuitacao(auto(), "2026-09")).toBe(0);
    expect(parcelaQuitada(auto(), "2026-09")).toBe(true);
  });
});
