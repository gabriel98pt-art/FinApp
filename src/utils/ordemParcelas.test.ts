import { describe, expect, test } from "vitest";
import type { Parcela } from "../types";
import {
  compararParcelas,
  ORDENS_PARCELA,
  parcelasVisiveis,
  ROTULOS_ORDEM_PARCELA,
} from "./ordemParcelas";

function parcela(extra: Partial<Parcela> = {}): Parcela {
  return {
    id: "p1",
    descricao: "Compra",
    total: 30000,
    numParcelas: 3,
    primeiroMes: "2026-06",
    pagoPorMes: {},
    ...extra,
  };
}

const ordenar = (lista: Parcela[], ordem: Parameters<typeof compararParcelas>[0]) =>
  [...lista].sort(compararParcelas(ordem)).map((p) => p.id);

test("as 8 opções têm rótulo, e as 4 genéricas continuam lá", () => {
  expect(ORDENS_PARCELA).toEqual([
    "recentes",
    "antigas",
    "maiorValor",
    "menorValor",
    "proximoVencimento",
    "valorRestante",
    "maiorValorParcela",
    "menorValorParcela",
  ]);
  for (const o of ORDENS_PARCELA) expect(ROTULOS_ORDEM_PARCELA[o]).toBeTruthy();
});

describe("ordens genéricas continuam valendo (data = mês da 1ª parcela)", () => {
  const antiga = parcela({ id: "antiga", primeiroMes: "2026-01", total: 10000 });
  const nova = parcela({ id: "nova", primeiroMes: "2026-09", total: 50000 });

  test("recentes: a mais nova primeiro", () => {
    expect(ordenar([antiga, nova], "recentes")).toEqual(["nova", "antiga"]);
  });

  test("antigas: a mais velha primeiro", () => {
    expect(ordenar([nova, antiga], "antigas")).toEqual(["antiga", "nova"]);
  });

  test("maiorValor / menorValor pelo total da compra", () => {
    expect(ordenar([antiga, nova], "maiorValor")).toEqual(["nova", "antiga"]);
    expect(ordenar([nova, antiga], "menorValor")).toEqual(["antiga", "nova"]);
  });
});

describe("proximoVencimento — mais cedo primeiro, quitada no fim", () => {
  test("ordena pelo próximo mês EM ABERTO, não pelo início do plano", () => {
    // 'adiantada' começou antes, mas já pagou junho e julho: o próximo mês em
    // aberto dela é agosto, depois do de 'atrasada'.
    const adiantada = parcela({
      id: "adiantada",
      primeiroMes: "2026-06",
      pagoPorMes: { "2026-06": true, "2026-07": true },
    });
    const atrasada = parcela({ id: "atrasada", primeiroMes: "2026-07" });
    expect(ordenar([adiantada, atrasada], "proximoVencimento")).toEqual(["atrasada", "adiantada"]);
  });

  test("parcela quitada vai pro fim", () => {
    const quitada = parcela({
      id: "quitada",
      pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
    });
    const aberta = parcela({ id: "aberta", primeiroMes: "2026-12" });
    expect(ordenar([quitada, aberta], "proximoVencimento")).toEqual(["aberta", "quitada"]);
  });

  test("duas quitadas empatam sem trocar de lugar", () => {
    const pagos = { "2026-06": true, "2026-07": true, "2026-08": true } as const;
    const a = parcela({ id: "a", pagoPorMes: { ...pagos } });
    const b = parcela({ id: "b", pagoPorMes: { ...pagos } });
    expect(ordenar([a, b], "proximoVencimento")).toEqual(["a", "b"]);
  });

  // O bug relatado: duas parcelas no mesmo mês empatavam (mesmo YearMonth) e a
  // ordem "por dia" nunca existia de facto — só parecia existir porque o sort
  // é estável e a lista costumava já vir mais ou menos em ordem.
  describe("dentro do MESMO mês, desempata pelo dia de vencimento", () => {
    const mesmoMes = { primeiroMes: "2026-08" } as const;

    test("dia menor primeiro", () => {
      const dia20 = parcela({ id: "dia20", ...mesmoMes, diaVencimento: 20 });
      const dia5 = parcela({ id: "dia5", ...mesmoMes, diaVencimento: 5 });
      expect(ordenar([dia20, dia5], "proximoVencimento")).toEqual(["dia5", "dia20"]);
    });

    test("sem dia dos dois, empate (mantém a ordem)", () => {
      const a = parcela({ id: "a", ...mesmoMes });
      const b = parcela({ id: "b", ...mesmoMes });
      expect(ordenar([a, b], "proximoVencimento")).toEqual(["a", "b"]);
    });

    test("sem dia só de um, essa vai depois de quem tem dia certo", () => {
      const semDia = parcela({ id: "semDia", ...mesmoMes });
      const comDia = parcela({ id: "comDia", ...mesmoMes, diaVencimento: 15 });
      expect(ordenar([semDia, comDia], "proximoVencimento")).toEqual(["comDia", "semDia"]);
    });

    test("em débito automático, usa o dia da fatura do cartão, não o diaVencimento cru", () => {
      const auto = parcela({
        id: "auto",
        ...mesmoMes,
        diaVencimento: 28, // ignorado — a fatura manda
        cartao: "AB Gold (C)",
        autoDebit: true,
      });
      const manual = parcela({ id: "manual", ...mesmoMes, diaVencimento: 10 });
      const comparar = compararParcelas("proximoVencimento", undefined, { "AB Gold (C)": 5 });
      expect([...[auto, manual]].sort(comparar).map((p) => p.id)).toEqual(["auto", "manual"]);
    });
  });
});

describe("valorRestante — maior primeiro", () => {
  test("usa o que falta pagar, não o total da compra", () => {
    // 'grande' custou mais, mas já pagou quase tudo: resta uma parcela.
    const grande = parcela({
      id: "grande",
      total: 90000,
      pagoPorMes: { "2026-06": true, "2026-07": true },
    });
    const pequena = parcela({ id: "pequena", total: 60000 });
    expect(ordenar([grande, pequena], "valorRestante")).toEqual(["pequena", "grande"]);
  });

  test("quitada (restante 0) cai pro fim sozinha", () => {
    const quitada = parcela({
      id: "quitada",
      pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
    });
    const aberta = parcela({ id: "aberta" });
    expect(ordenar([quitada, aberta], "valorRestante")).toEqual(["aberta", "quitada"]);
  });
});

describe("maiorValorParcela / menorValorParcela — o que sai no mês", () => {
  // A distinção que as ordens genéricas de valor não fazem: 'cara' custou menos
  // ao todo, mas pesa mais por mês, porque foi em 2x em vez de 20x.
  const cara = parcela({ id: "cara", total: 60000, numParcelas: 2 }); // 300,00/mês
  const grandeTotal = parcela({ id: "grandeTotal", total: 200000, numParcelas: 20 }); // 100,00/mês

  test("maior valor da parcela: a de mensalidade mais alta primeiro", () => {
    expect(ordenar([grandeTotal, cara], "maiorValorParcela")).toEqual(["cara", "grandeTotal"]);
  });

  test("menor valor da parcela: o contrário", () => {
    expect(ordenar([cara, grandeTotal], "menorValorParcela")).toEqual(["grandeTotal", "cara"]);
  });

  test("é mesmo a mensalidade, não o total — 'maiorValor' genérico dá o contrário", () => {
    // A prova de que a ordem nova não é a antiga com outro nome.
    expect(ordenar([cara, grandeTotal], "maiorValor")).toEqual(["grandeTotal", "cara"]);
    expect(ordenar([cara, grandeTotal], "maiorValorParcela")).toEqual(["cara", "grandeTotal"]);
  });

  test("quitada tem mensalidade 0 e cai pro fim em 'maior'", () => {
    const quitada = parcela({
      id: "quitada",
      pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
    });
    const aberta = parcela({ id: "aberta" });
    expect(ordenar([quitada, aberta], "maiorValorParcela")).toEqual(["aberta", "quitada"]);
  });

  test("em 'menor' a quitada vem à frente no comparador, mas a tela põe-na no fim", () => {
    const quitada = parcela({
      id: "quitada",
      pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
    });
    const aberta = parcela({ id: "aberta" });
    // Sozinho, o comparador põe a mensalidade 0 em primeiro.
    expect(ordenar([aberta, quitada], "menorValorParcela")).toEqual(["quitada", "aberta"]);
    // Mas na lista real a quitada vai para o grupo de trás, como em qualquer ordem.
    expect(parcelasVisiveis([aberta, quitada], "menorValorParcela").map((p) => p.id)).toEqual([
      "aberta",
      "quitada",
    ]);
  });
});

describe("parcelasVisiveis — a lista como a tela a mostra", () => {
  // Cenário com meses em aberto espalhados: uma atrasada (janeiro por pagar),
  // uma com buraco no meio, uma em curso, uma que só começa em setembro, e
  // duas já quitadas.
  const atrasada = parcela({ id: "atrasada", primeiroMes: "2026-01", numParcelas: 6 });
  const buraco = parcela({
    id: "buraco",
    primeiroMes: "2026-02",
    numParcelas: 6,
    pagoPorMes: { "2026-02": true },
  });
  const emCurso = parcela({
    id: "emCurso",
    primeiroMes: "2026-05",
    numParcelas: 5,
    pagoPorMes: { "2026-05": true, "2026-06": true },
  });
  const futura = parcela({ id: "futura", primeiroMes: "2026-09", numParcelas: 4 });
  const quitadaNova = parcela({
    id: "quitadaNova",
    primeiroMes: "2026-01",
    numParcelas: 3,
    pagoPorMes: { "2026-01": true, "2026-02": true, "2026-03": true },
  });
  const quitadaVelha = parcela({
    id: "quitadaVelha",
    primeiroMes: "2025-01",
    numParcelas: 2,
    pagoPorMes: { "2025-01": true, "2025-02": true },
  });
  const todas = [quitadaNova, futura, atrasada, quitadaVelha, emCurso, buraco];

  test("por próximo vencimento: as não pagas primeiro, da mais atrasada à mais distante", () => {
    expect(parcelasVisiveis(todas, "proximoVencimento").map((p) => p.id)).toEqual([
      "atrasada", // 2026-01 por pagar
      "buraco", // 2026-03
      "emCurso", // 2026-07
      "futura", // 2026-09
      "quitadaNova",
      "quitadaVelha",
    ]);
  });

  test("mesmo com a ordem escolhida às avessas, nenhuma quitada passa à frente de uma em aberto", () => {
    // "antigas" põe a quitadaVelha (2025-01) em primeiro dentro do seu grupo,
    // mas o grupo dela continua depois de todas as que têm mês em aberto.
    const ids = parcelasVisiveis(todas, "antigas").map((p) => p.id);
    expect(ids.slice(0, 4).sort()).toEqual(["atrasada", "buraco", "emCurso", "futura"]);
    expect(ids.slice(4)).toEqual(["quitadaVelha", "quitadaNova"]);
  });

  test('"apenas" mostra SÓ as quitadas — as em aberto é que ficam fora', () => {
    const comFiltro = parcelasVisiveis(todas, "proximoVencimento", "apenas").map((p) => p.id);
    expect(comFiltro).toEqual(["quitadaNova", "quitadaVelha"]);
  });

  test('"ocultar" tira as quitadas da lista, mantendo só as em aberto', () => {
    const oculto = parcelasVisiveis(todas, "proximoVencimento", "ocultar").map((p) => p.id);
    expect(oculto).toEqual(["atrasada", "buraco", "emCurso", "futura"]);
  });

  test('"todas" (o padrão) mostra tudo, em aberto primeiro', () => {
    const semFiltro = parcelasVisiveis(todas, "proximoVencimento", "todas").map((p) => p.id);
    expect(semFiltro).toEqual(parcelasVisiveis(todas, "proximoVencimento").map((p) => p.id));
    expect(semFiltro).toHaveLength(6);
  });

  test("não altera o array recebido", () => {
    const copia = [...todas];
    parcelasVisiveis(todas, "recentes");
    expect(todas).toEqual(copia);
  });
});
