import { describe, expect, it } from "vitest";
import type { Abastecimento } from "../types";
import { ordenarLocaisPorUso } from "./locais";

function carga(local: string, data: string): Abastecimento {
  return { id: `${local}-${data}`, data, local, custo: 1000, kwh: 10, precoKwh: 100 };
}

describe("ordenarLocaisPorUso", () => {
  it("põe o local mais usado à frente", () => {
    const opcoes = ["Ionity A1", "Casa", "Galp"];
    const cargas = [
      carga("Casa", "2026-08-01"),
      carga("Casa", "2026-08-05"),
      carga("Casa", "2026-08-10"),
      carga("Galp", "2026-08-12"),
    ];
    expect(ordenarLocaisPorUso(opcoes, cargas)).toEqual(["Casa", "Galp", "Ionity A1"]);
  });

  it("desempata pela carga mais recente", () => {
    const opcoes = ["A", "B"];
    const cargas = [carga("A", "2026-08-01"), carga("B", "2026-08-09")];
    expect(ordenarLocaisPorUso(opcoes, cargas)).toEqual(["B", "A"]);
  });

  it("manda os nunca usados para o fim, na ordem de cadastro", () => {
    const opcoes = ["Novo1", "Usado", "Novo2"];
    const cargas = [carga("Usado", "2026-08-01")];
    expect(ordenarLocaisPorUso(opcoes, cargas)).toEqual(["Usado", "Novo1", "Novo2"]);
  });

  it("sem histórico devolve a lista tal como está", () => {
    const opcoes = ["A", "B", "C"];
    expect(ordenarLocaisPorUso(opcoes, [])).toEqual(opcoes);
  });

  it("ignora cargas de locais que já não estão cadastrados", () => {
    const opcoes = ["A", "B"];
    const cargas = [carga("Apagado", "2026-08-20"), carga("B", "2026-08-01")];
    expect(ordenarLocaisPorUso(opcoes, cargas)).toEqual(["B", "A"]);
  });

  it("não perde nem repete nenhum local", () => {
    const opcoes = ["A", "B", "C", "D"];
    const cargas = [carga("C", "2026-08-02"), carga("A", "2026-08-03")];
    const saida = ordenarLocaisPorUso(opcoes, cargas);
    expect([...saida].sort()).toEqual([...opcoes].sort());
  });

  it("não altera o array recebido", () => {
    const opcoes = ["A", "B"];
    ordenarLocaisPorUso(opcoes, [carga("B", "2026-08-01")]);
    expect(opcoes).toEqual(["A", "B"]);
  });
});
