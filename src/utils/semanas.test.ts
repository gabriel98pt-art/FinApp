import { describe, expect, it } from "vitest";
import { somarDias } from "./calculos";
import { indiceDaSemana, naSemana, rotuloDaSemana, semanasDoMes } from "./semanas";

describe("semanasDoMes", () => {
  it("cobre o mês inteiro em blocos de 7 dias, começando no dia pedido", () => {
    // 01/07/2026 é quarta; com a semana começando na segunda (1), a primeira
    // célula é a segunda anterior.
    const s = semanasDoMes("2026-07", 1);
    expect(s.length).toBe(5);
    expect(s[0]).toEqual({ inicio: "2026-06-29", fim: "2026-07-05" });
    expect(s[4]).toEqual({ inicio: "2026-07-27", fim: "2026-08-02" });
  });

  it("outro dia de início desloca o grid inteiro (domingo, o de antes)", () => {
    const s = semanasDoMes("2026-07", 0);
    expect(s[0]).toEqual({ inicio: "2026-06-28", fim: "2026-07-04" });
    expect(s[4]).toEqual({ inicio: "2026-07-26", fim: "2026-08-01" });
  });

  // `somarDias` (não `new Date` + `setDate` + `toISOString`) porque março
  // atravessa a virada do horário de verão na Europa — misturar data em UTC
  // com aritmética de calendário em hora local desalinhava o dia aqui.
  it("não deixa buraco entre uma semana e a seguinte", () => {
    const s = semanasDoMes("2026-03", 1);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].inicio).toBe(somarDias(s[i - 1].fim, 1));
    }
  });

  it("mês que fecha em semanas exatas não ganha bloco extra", () => {
    // fev/2027 começa numa segunda e tem 28 dias → 4 semanas cheias, com a
    // semana começando na segunda.
    expect(semanasDoMes("2027-02", 1).length).toBe(4);
  });
});

describe("indiceDaSemana", () => {
  const s = semanasDoMes("2026-07", 1);

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
