// @vitest-environment jsdom

// A lista de lançamentos: em blocos de um dia quando a ordem é por data, e
// corrida nas outras.

import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendingDown } from "lucide-react";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ItemLista } from "./ListaLancamentos";

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg: CONFIG_PADRAO }),
}));

const ListaLancamentos = (await import("./ListaLancamentos")).default;

const item = (
  id: string,
  data: string,
  valor: number,
  extra: Partial<ItemLista> = {},
): ItemLista => ({
  id,
  descricao: `Item ${id}`,
  valor,
  data,
  etiqueta: "Mercado",
  categoria: "Mercado",
  ...extra,
});

const ITENS = [
  item("a", "2026-10-24", 3870),
  item("b", "2026-10-23", 1240),
  item("c", "2026-10-23", 1940),
  item("d", "2026-10-20", 34117),
];

function desenhar(props: { agruparPorDia: boolean; itens?: ItemLista[]; aoEditar?: () => void }) {
  return render(
    <ListaLancamentos
      itens={props.itens ?? ITENS}
      carregado
      tom="vermelho"
      vazio="Nada"
      vazioIcone={TrendingDown}
      moeda="EUR"
      aoAdicionar={() => {}}
      aoEditar={props.aoEditar ?? (() => {})}
      aoExcluir={() => {}}
      agruparPorDia={props.agruparPorDia}
    />,
  );
}

describe("ListaLancamentos — por data", () => {
  test("separa em blocos de um dia, com o dia da semana e a data no cabeçalho", () => {
    desenhar({ agruparPorDia: true });
    const dias = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(dias).toEqual(["Sábado, 24 out", "Sexta, 23 out", "Terça, 20 out"]);
  });

  test("o dia com 2 ou mais movimentos traz o total à direita do cabeçalho", () => {
    desenhar({ agruparPorDia: true });
    const sexta = screen.getByRole("heading", { name: "Sexta, 23 out" }).parentElement!;
    // 12,40 + 19,40
    expect(within(sexta).getByText("€ 31,80")).toBeInTheDocument();
  });

  test("o dia com 1 movimento só mostra a data, sem total", () => {
    desenhar({ agruparPorDia: true });
    const sabado = screen.getByRole("heading", { name: "Sábado, 24 out" }).parentElement!;
    expect(within(sabado).queryByText("€ 38,70")).not.toBeInTheDocument();
    // O valor aparece só na linha, uma vez.
    expect(screen.getAllByText("€ 38,70")).toHaveLength(1);
  });

  test("o dia que não conta nos totais deixa-o de fora da soma do dia", () => {
    desenhar({
      agruparPorDia: true,
      itens: [
        item("a", "2026-10-24", 3870),
        item("g", "2026-10-24", 1000),
        item("f", "2026-10-24", 100000, { foraDoTotal: true }),
      ],
    });
    const dia = screen.getByRole("heading", { name: "Sábado, 24 out" }).parentElement!;
    // 38,70 + 10,00; o item fora do total não entra.
    expect(within(dia).getByText("€ 48,70")).toBeInTheDocument();
    // A linha em si continua a aparecer.
    expect(screen.getByText("Item f")).toBeInTheDocument();
  });

  test("a data não se repete em cada linha: o cabeçalho já a diz", () => {
    desenhar({ agruparPorDia: true });
    expect(screen.queryByText(/24\/10/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Mercado")).toHaveLength(4);
  });

  test("a linha continua a abrir o menu de ações", async () => {
    desenhar({ agruparPorDia: true });
    await userEvent.click(screen.getByText("Item a"));
    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
  });
});

describe("ListaLancamentos — outras ordens", () => {
  test("lista corrida: sem cabeçalhos de dia", () => {
    desenhar({ agruparPorDia: false });
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  test("na lista corrida a data vem na linha, antes da etiqueta", () => {
    desenhar({ agruparPorDia: false });
    expect(screen.getAllByText("24/10 · Mercado")).toHaveLength(1);
    expect(screen.getAllByText("23/10 · Mercado")).toHaveLength(2);
  });

  test("por omissão a lista é corrida", () => {
    render(
      <ListaLancamentos
        itens={ITENS}
        carregado
        tom="vermelho"
        vazio="Nada"
        vazioIcone={TrendingDown}
        moeda="EUR"
        aoAdicionar={() => {}}
        aoEditar={() => {}}
        aoExcluir={() => {}}
      />,
    );
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });
});

describe("ListaLancamentos — valores", () => {
  test("despesa: o valor simples, sem sinal; só o que entra leva + e verde", () => {
    desenhar({
      agruparPorDia: false,
      itens: [item("a", "2026-10-24", 3870), item("r", "2026-10-24", -2000)],
    });
    const despesa = screen.getByText("Item a").closest("button")!;
    expect(despesa.textContent).toContain("€ 38,70");
    expect(despesa.textContent).not.toContain("+");
    expect(despesa.textContent).not.toContain("−");
    const reembolso = screen.getByText("Item r").closest("button")!;
    expect(reembolso.textContent).toContain("+€ 20,00");
  });
});
