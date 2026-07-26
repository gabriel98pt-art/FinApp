import { describe, expect, test } from "vitest";
import type { Parcela } from "../types";
import { compararParcelas, ORDENS_PARCELA, ROTULOS_ORDEM_PARCELA } from "./ordemParcelas";

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

test("as 6 opções têm rótulo, e as 4 genéricas continuam lá", () => {
  expect(ORDENS_PARCELA).toEqual([
    "recentes",
    "antigas",
    "maiorValor",
    "menorValor",
    "proximoVencimento",
    "valorRestante",
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
