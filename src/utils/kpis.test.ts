import { describe, expect, test } from "vitest";
import { chaveEmDestaque } from "./kpis";

const CHAVES = ["Total do mês", "Maior categoria", "vs mês passado", "Média (3 meses)"];
const SEM_ESCOLHA = { kpiDestaque: {}, kpisMobile: {} };

describe("chaveEmDestaque", () => {
  test("página sem nenhuma escolha: o primeiro KPI", () => {
    expect(chaveEmDestaque("despesas", CHAVES, SEM_ESCOLHA)).toBe("Total do mês");
  });

  test("a escolha guardada manda", () => {
    const cfg = { kpiDestaque: { despesas: "vs mês passado" }, kpisMobile: {} };
    expect(chaveEmDestaque("despesas", CHAVES, cfg)).toBe("vs mês passado");
  });

  test("a escolha é por página: outra página não é afetada", () => {
    const cfg = { kpiDestaque: { receitas: "vs mês passado" }, kpisMobile: {} };
    expect(chaveEmDestaque("despesas", CHAVES, cfg)).toBe("Total do mês");
  });

  test("sem escolha nova, o primeiro da antiga escolha de 2 KPIs no telemóvel", () => {
    const cfg = {
      kpiDestaque: {},
      kpisMobile: { despesas: ["Maior categoria", "Média (3 meses)"] as [string, string] },
    };
    expect(chaveEmDestaque("despesas", CHAVES, cfg)).toBe("Maior categoria");
  });

  test("a escolha nova ganha da antiga", () => {
    const cfg = {
      kpiDestaque: { despesas: "Média (3 meses)" },
      kpisMobile: { despesas: ["Maior categoria", "vs mês passado"] as [string, string] },
    };
    expect(chaveEmDestaque("despesas", CHAVES, cfg)).toBe("Média (3 meses)");
  });

  test("chave guardada que já não existe cai na antiga e depois no primeiro", () => {
    const antiga = {
      kpiDestaque: { despesas: "KPI que foi renomeado" },
      kpisMobile: { despesas: ["Maior categoria", "vs mês passado"] as [string, string] },
    };
    expect(chaveEmDestaque("despesas", CHAVES, antiga)).toBe("Maior categoria");
    const nenhuma = { kpiDestaque: { despesas: "KPI que foi renomeado" }, kpisMobile: {} };
    expect(chaveEmDestaque("despesas", CHAVES, nenhuma)).toBe("Total do mês");
  });

  test("antiga escolha com uma chave morta usa a outra", () => {
    const cfg = {
      kpiDestaque: {},
      kpisMobile: { despesas: ["Já não existe", "vs mês passado"] as [string, string] },
    };
    expect(chaveEmDestaque("despesas", CHAVES, cfg)).toBe("vs mês passado");
  });

  test("sem página (Calendário, TVDE): o primeiro", () => {
    expect(chaveEmDestaque(undefined, CHAVES, SEM_ESCOLHA)).toBe("Total do mês");
  });

  test("sem KPIs não há destaque", () => {
    expect(chaveEmDestaque("despesas", [], SEM_ESCOLHA)).toBeUndefined();
  });
});
