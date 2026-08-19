import { describe, expect, it, test } from "vitest";
import type { EventoCalendario } from "../types";
import {
  diasComEventoNoMes,
  diasDoGrid,
  eventosComValor,
  eventosDoDia,
  proximosEventos,
  rotulosDiasSemana,
  totalEventos,
} from "./calendario";
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
  it("preenche semanas completas (múltiplo de 7), com a semana começando em qualquer dia", () => {
    for (const ym of ["2026-01", "2026-02", "2026-07", "2024-02", "2026-08"]) {
      for (let inicio = 0; inicio < 7; inicio++) {
        expect(diasDoGrid(ym, inicio).length % 7).toBe(0);
      }
    }
  });

  it("inclui todos os dias do mês, em ordem — seja qual for o dia de início", () => {
    for (const inicio of [0, 1]) {
      const doMes = diasDoGrid("2026-07", inicio).filter((c) => !c.foraDoMes);
      expect(doMes.length).toBe(31);
      expect(doMes[0].data).toBe("2026-07-01");
      expect(doMes[30].data).toBe("2026-07-31");
    }
  });

  it("fecha a última semana com dias do mês seguinte, sem repetir", () => {
    const datas = diasDoGrid("2026-07", 1).map((c) => c.data);
    expect(new Set(datas).size).toBe(datas.length);
    expect(datas[datas.length - 1]).toBe("2026-08-02");
  });

  it("não adiciona preenchimento quando o mês já fecha em semanas exatas, começando na segunda", () => {
    // fev/2027 começa numa segunda e tem 28 dias → 4 semanas cheias
    const grid = diasDoGrid("2027-02", 1);
    expect(grid.length).toBe(28);
    expect(grid.every((c) => !c.foraDoMes)).toBe(true);
  });

  it("o mesmo mês, mas com a semana começando no domingo, ganha preenchimento", () => {
    // fev/2026 começa num domingo e tem 28 dias → exato só se a semana também
    // começar no domingo.
    expect(diasDoGrid("2026-02", 0).length).toBe(28);
    expect(diasDoGrid("2026-02", 1).length).toBe(35);
  });

  it("começa no dia escolhido da semana que contém o dia 1", () => {
    // 01/07/2026 é uma quarta → com a semana na segunda, 2 dias de junho antes.
    const grid = diasDoGrid("2026-07", 1);
    expect(grid[0].data).toBe("2026-06-29");
    expect(grid[0].foraDoMes).toBe(true);
  });

  it("outro dia de início muda onde o grid começa", () => {
    // com a semana no sábado (6), a quarta 01/07 pega 3 dias de junho antes.
    const grid = diasDoGrid("2026-07", 6);
    expect(grid[0].data).toBe("2026-06-27");
  });
});

describe("rotulosDiasSemana", () => {
  it("sem giro (domingo), é a lista original", () => {
    expect(rotulosDiasSemana(0)).toEqual(["D", "S", "T", "Q", "Q", "S", "S"]);
  });

  it("gira a partir do dia pedido — segunda primeiro", () => {
    expect(rotulosDiasSemana(1)).toEqual(["S", "T", "Q", "Q", "S", "S", "D"]);
  });
});

// O KPI do Calendário soma dinheiro, e o valor do evento é opcional — um
// "consulta às 9h" não pode entrar em soma nenhuma.
describe("eventos com valor", () => {
  const eventos = [
    evento({ id: "e1", valor: 2500 }),
    evento({ id: "e2" }),
    evento({ id: "e3", valor: 1000 }),
  ];

  it("eventosComValor deixa de fora os que não têm valor", () => {
    expect(eventosComValor(eventos).map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("totalEventos soma só o que tem valor", () => {
    expect(totalEventos(eventos)).toBe(3500);
    expect(totalEventos([evento({ id: "so-titulo" })])).toBe(0);
    expect(totalEventos([])).toBe(0);
  });
});
