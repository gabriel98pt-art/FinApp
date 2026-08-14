import { describe, expect, it } from "vitest";
import type { DespesaFixa, Parcela } from "../types";
import {
  porDia,
  vencimentosDeFaturas,
  vencimentosDeFixas,
  vencimentosDeParcelas,
} from "./vencimentos";

function fixa(extra: Partial<DespesaFixa> = {}): DespesaFixa {
  return {
    id: "f1",
    descricao: "Renda",
    valor: 50000,
    categoria: "Casa",
    pagoPorMes: {},
    ...extra,
  };
}

function parcela(extra: Partial<Parcela> = {}): Parcela {
  return {
    id: "p1",
    descricao: "Sofá",
    total: 30000,
    numParcelas: 3,
    primeiroMes: "2026-06",
    pagoPorMes: {},
    ...extra,
  };
}

describe("vencimentosDeFixas", () => {
  it("marca só as fixas que têm dia de vencimento", () => {
    const v = vencimentosDeFixas([fixa({ diaVencimento: 8 }), fixa({ id: "f2" })], "2026-07");
    expect(v).toHaveLength(1);
    expect(v[0].dia).toBe("2026-07-08");
    expect(v[0].tipo).toBe("fixa");
  });

  it("respeita a janela de início/fim da fixa", () => {
    const f = fixa({ diaVencimento: 5, inicio: "2026-08" });
    expect(vencimentosDeFixas([f], "2026-07")).toHaveLength(0);
    expect(vencimentosDeFixas([f], "2026-08")).toHaveLength(1);
  });

  it("limita o dia ao último dia real do mês", () => {
    const v = vencimentosDeFixas([fixa({ diaVencimento: 31 })], "2026-02");
    expect(v[0].dia).toBe("2026-02-28");
  });

  // O bug relatado: o Calendário marcava o dia de uma fixa já paga como se
  // ainda estivesse por fazer — nenhum outro ecrã do app faz isso.
  it("fixa já marcada como paga não aparece mais como vencimento", () => {
    const f = fixa({ diaVencimento: 8, pagoPorMes: { "2026-07": true } });
    expect(vencimentosDeFixas([f], "2026-07")).toHaveLength(0);
  });

  it("com mesReferencia/hoje, fixa em débito automático some depois do vencimento", () => {
    const f = fixa({ diaVencimento: 8, contaCartao: "AB Gold", autoDebit: true });
    expect(vencimentosDeFixas([f], "2026-07", "2026-07", "2026-07-05")).toHaveLength(1);
    expect(vencimentosDeFixas([f], "2026-07", "2026-07", "2026-07-08")).toHaveLength(0);
  });

  it("sem mesReferencia/hoje, comportamento de sempre — só o marcado à mão some", () => {
    const f = fixa({ diaVencimento: 8, contaCartao: "AB Gold", autoDebit: true });
    expect(vencimentosDeFixas([f], "2026-07")).toHaveLength(1);
  });
});

describe("vencimentosDeParcelas", () => {
  it("marca só os meses dentro do plano", () => {
    const p = parcela({ diaVencimento: 10 }); // jun, jul, ago de 2026
    expect(vencimentosDeParcelas([p], "2026-07")).toHaveLength(1);
    expect(vencimentosDeParcelas([p], "2026-09")).toHaveLength(0);
  });

  it("indica qual parcela do plano é aquele mês", () => {
    const v = vencimentosDeParcelas([parcela({ diaVencimento: 10 })], "2026-08");
    expect(v[0].detalhe).toBe("parcela 3/3");
    expect(v[0].valor).toBe(10000);
  });

  it("ignora parcela sem dia de vencimento", () => {
    expect(vencimentosDeParcelas([parcela()], "2026-07")).toHaveLength(0);
  });

  // O bug relatado por quem usa o app: uma parcela já paga naquele mês
  // continuava a aparecer no Calendário como vencimento — e não aparecia
  // mais como pendente na própria tela Parcelas. As duas telas discordavam.
  it("mês já pago não aparece mais como vencimento", () => {
    const p = parcela({ diaVencimento: 10, pagoPorMes: { "2026-07": true } });
    expect(vencimentosDeParcelas([p], "2026-07")).toHaveLength(0);
  });

  it("com mesReferencia/hoje, parcela em débito automático some depois do vencimento", () => {
    const p = parcela({ diaVencimento: 10, cartao: "AB Gold", autoDebit: true });
    expect(vencimentosDeParcelas([p], "2026-07", undefined, "2026-07", "2026-07-05")).toHaveLength(
      1,
    );
    expect(vencimentosDeParcelas([p], "2026-07", undefined, "2026-07", "2026-07-10")).toHaveLength(
      0,
    );
  });
});

describe("vencimentosDeFaturas", () => {
  it("cai no dia 1 e ignora fatura sem restante", () => {
    const v = vencimentosDeFaturas(
      [
        { cartao: "AB Gold", restante: 12345 },
        { cartao: "Vazio", restante: 0 },
      ],
      "2026-07",
    );
    expect(v).toHaveLength(1);
    expect(v[0].dia).toBe("2026-07-01");
    expect(v[0].titulo).toBe("Fatura AB Gold");
    expect(v[0].valor).toBe(12345);
  });

  // O bug relatado: o Calendário mostrava a fatura inteira mesmo já paga,
  // porque filtrava por `devido` (o total bruto do ciclo) em vez de
  // `restante` (o que falta depois dos pagamentos).
  it("uma fatura já paga (restante 0) não aparece, mesmo com devido alto", () => {
    const v = vencimentosDeFaturas([{ cartao: "AB Gold", restante: 0 }], "2026-07");
    expect(v).toHaveLength(0);
  });
});

describe("porDia", () => {
  it("agrupa vários compromissos no mesmo dia", () => {
    const mapa = porDia([
      ...vencimentosDeFixas([fixa({ diaVencimento: 8 })], "2026-07"),
      ...vencimentosDeParcelas([parcela({ diaVencimento: 8 })], "2026-07"),
    ]);
    expect(mapa.get("2026-07-08")).toHaveLength(2);
    expect(mapa.has("2026-07-09")).toBe(false);
  });
});
