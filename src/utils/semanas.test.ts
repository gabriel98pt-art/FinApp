import { describe, expect, it } from "vitest";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "./semanas";

describe("semanasDoMes", () => {
  it("cobre o mês inteiro em blocos de 7 dias", () => {
    const s = semanasDoMes("2026-07"); // 01/07/2026 é quarta
    expect(s.length).toBe(5);
    expect(s[0]).toEqual({ inicio: "2026-06-28", fim: "2026-07-04" });
    expect(s[4]).toEqual({ inicio: "2026-07-26", fim: "2026-08-01" });
  });

  it("não deixa buraco entre uma semana e a seguinte", () => {
    const s = semanasDoMes("2026-03");
    for (let i = 1; i < s.length; i++) {
      const anterior = new Date(s[i - 1].fim);
      anterior.setDate(anterior.getDate() + 1);
      expect(s[i].inicio).toBe(anterior.toISOString().slice(0, 10));
    }
  });

  it("mês que fecha em semanas exatas não ganha bloco extra", () => {
    expect(semanasDoMes("2026-02").length).toBe(4);
  });
});

describe("indiceDaSemana", () => {
  const s = semanasDoMes("2026-07");

  it("acha a semana que contém o dia", () => {
    expect(indiceDaSemana(s, "2026-07-09")).toBe(1);
    expect(indiceDaSemana(s, "2026-07-01")).toBe(0);
  });

  // O caso comum: header ainda num mês antigo, hoje já passou dele — "abrir a
  // semana atual" quer dizer a última do mês exibido, a mais perto de hoje.
  it("cai na última semana quando o dia é depois do mês (mês antigo no header)", () => {
    expect(indiceDaSemana(s, "2026-12-25")).toBe(s.length - 1);
  });

  it("cai na primeira semana quando o dia é antes do mês (mês no futuro)", () => {
    expect(indiceDaSemana(s, "2026-01-05")).toBe(0);
  });
});

describe("naSemana", () => {
  it("inclui as duas pontas e exclui o resto", () => {
    const semana = { inicio: "2026-07-06", fim: "2026-07-12" };
    const itens = [
      { id: "antes", data: "2026-07-05" },
      { id: "inicio", data: "2026-07-06" },
      { id: "meio", data: "2026-07-09" },
      { id: "fim", data: "2026-07-12" },
      { id: "depois", data: "2026-07-13" },
    ];
    expect(naSemana(itens, semana).map((i) => i.id)).toEqual(["inicio", "meio", "fim"]);
  });
});

describe("rotuloDaSemana", () => {
  it("formata como dd/mm – dd/mm", () => {
    expect(rotuloDaSemana({ inicio: "2026-07-02", fim: "2026-07-08" })).toBe("02/07 – 08/07");
  });
});
