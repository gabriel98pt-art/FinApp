import { describe, expect, it, test } from "vitest";
import type { EventoCalendario } from "../types";
import { diasComEventoNoMes, diasDoGrid, eventosDoDia, proximosEventos } from "./calendario";
import { somarDias } from "./calculos";

function evento(extra: Partial<EventoCalendario> = {}): EventoCalendario {
  return { id: "e1", titulo: "Evento", data: "2026-07-15", ...extra };
}

test("somarDias vira o mês corretamente", () => {
  expect(somarDias("2026-07-28", 7)).toBe("2026-08-04");
  expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
});

test("eventosDoDia filtra pela data exata", () => {
  const eventos = [
    evento({ id: "a", data: "2026-07-15" }),
    evento({ id: "b", data: "2026-07-16" }),
  ];
  expect(eventosDoDia(eventos, "2026-07-15").map((e) => e.id)).toEqual(["a"]);
});

test("diasComEventoNoMes só do mês pedido", () => {
  const eventos = [evento({ data: "2026-07-15" }), evento({ data: "2026-08-01" })];
  const dias = diasComEventoNoMes(eventos, "2026-07");
  expect(dias.has("2026-07-15")).toBe(true);
  expect(dias.has("2026-08-01")).toBe(false);
});

describe("proximosEventos — janela de 7 dias (mesma do Copiloto)", () => {
  const hoje = "2026-07-20";

  test("inclui hoje e o 7º dia, exclui o 8º e o passado", () => {
    const eventos = [
      evento({ id: "passado", data: "2026-07-19" }),
      evento({ id: "hoje", data: "2026-07-20" }),
      evento({ id: "dentro", data: "2026-07-25" }),
      evento({ id: "limite", data: "2026-07-27" }), // hoje+7
      evento({ id: "fora", data: "2026-07-28" }), // hoje+8
    ];
    const ids = proximosEventos(eventos, hoje).map((e) => e.id);
    expect(ids).toEqual(["hoje", "dentro", "limite"]);
  });

  test("ordena por data crescente", () => {
    const eventos = [
      evento({ id: "b", data: "2026-07-25" }),
      evento({ id: "a", data: "2026-07-21" }),
    ];
    expect(proximosEventos(eventos, hoje).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("diasDoGrid", () => {
  it("preenche semanas completas (múltiplo de 7)", () => {
    for (const ym of ["2026-01", "2026-02", "2026-07", "2024-02", "2026-08"]) {
      expect(diasDoGrid(ym).length % 7).toBe(0);
    }
  });

  it("inclui todos os dias do mês, em ordem", () => {
    const doMes = diasDoGrid("2026-07").filter((c) => !c.foraDoMes);
    expect(doMes.length).toBe(31);
    expect(doMes[0].data).toBe("2026-07-01");
    expect(doMes[30].data).toBe("2026-07-31");
  });

  it("fecha a última semana com dias do mês seguinte, sem repetir", () => {
    const datas = diasDoGrid("2026-07").map((c) => c.data);
    expect(new Set(datas).size).toBe(datas.length);
    expect(datas[datas.length - 1]).toBe("2026-08-01");
  });

  it("não adiciona preenchimento quando o mês já fecha em semanas exatas", () => {
    // fev/2026 começa num domingo e tem 28 dias → 4 semanas cheias
    const grid = diasDoGrid("2026-02");
    expect(grid.length).toBe(28);
    expect(grid.every((c) => !c.foraDoMes)).toBe(true);
  });

  it("começa no domingo da semana do dia 1", () => {
    // 01/07/2026 é uma quarta → 3 dias de junho antes
    const grid = diasDoGrid("2026-07");
    expect(grid[0].data).toBe("2026-06-28");
    expect(grid[0].foraDoMes).toBe(true);
  });
});
