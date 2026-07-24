import { describe, expect, test } from "vitest";
import type { EventoCalendario } from "../types";
import { diasComEventoNoMes, eventosDoDia, proximosEventos } from "./calendario";
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
