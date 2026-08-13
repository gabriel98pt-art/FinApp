// @vitest-environment jsdom

// Planejamento é uma tela fina: o conteúdo todo é o OrcamentoCard. O que se
// testa aqui é portanto o cartão — sobretudo as linhas de categoria, que são
// botões e que este trabalho reescreveu para deixarem de ter <div> lá dentro.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DespesaCorrente } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista } from "../testes/dobras";
import { KPIS_POR_PAGINA } from "../constants/kpis";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
const definirOrcamentoTotal = vi.fn(async () => {});
vi.mock("../services/cfgService", () => ({
  definirOrcamento: vi.fn(async () => {}),
  definirOrcamentoTotal: (...a: unknown[]) => definirOrcamentoTotal(...(a as [])),
}));

let despesas = lista<DespesaCorrente>();
let cfg = { ...CONFIG_PADRAO };

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));

const Planejamento = (await import("./Planejamento")).default;

const despesa = (valor: number, categoria = "Alimentação"): DespesaCorrente =>
  ({
    id: `d${valor}`,
    descricao: "Mercado",
    valor,
    data: "2026-08-03",
    categoria,
  }) as DespesaCorrente;

beforeEach(() => {
  despesas = lista<DespesaCorrente>();
  cfg = { ...CONFIG_PADRAO };
  definirOrcamentoTotal.mockClear();
});

describe("Planejamento", () => {
  test("monta e mostra o título", () => {
    render(<Planejamento />);
    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
  });

  test("sem tectos definidos: convida a definir o primeiro", () => {
    render(<Planejamento />);
    expect(screen.getByText(/Defina um teto mensal por categoria/)).toBeInTheDocument();
  });

  test("com teto: mostra a categoria, a percentagem gasta e é clicável", () => {
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 40000 } };
    despesas = lista([despesa(10000)]);
    render(<Planejamento />);

    const linha = screen.getByRole("button", { name: /Alimentação/ });
    expect(linha).toBeInTheDocument();
    // A percentagem em texto: a barra ao lado é só o eco visual dela.
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("a linha do orçamento não tem <div> lá dentro", () => {
    // O conteúdo de um <button> é, por especificação, conteúdo de frase. Esta
    // linha tinha quatro <div>, o que é HTML inválido — e era drift, porque as
    // outras listas clicáveis do app já usavam <span>.
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 40000 } };
    despesas = lista([despesa(10000)]);
    render(<Planejamento />);

    const linha = screen.getByRole("button", { name: /Alimentação/ });
    expect(linha.querySelector("div")).toBeNull();
  });

  test("estouro do teto aparece como selo, não só como cor", () => {
    // A cor sozinha não chega a quem não a distingue.
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 10000 } };
    despesas = lista([despesa(15000)]);
    render(<Planejamento />);

    expect(screen.getByText("Estourou")).toBeInTheDocument();
  });
});

// Os quatro cartões do plano do mês.
//
// O que eles medem é o gasto das categorias QUE TÊM TETO, não o gasto do mês
// todo — é a leitura que fecha com a lista logo abaixo. Um gasto numa
// categoria sem teto não tem plano contra o qual ser medido.
/** O valor de um KPI, pelo rótulo. Preciso porque a percentagem do cartão pode
 *  coincidir com a de uma linha de categoria logo abaixo — e aí um
 *  `getByText("100%")` acha duas e falha sem que nada esteja errado. */
const valorDoCard = (rotulo: string) =>
  screen.getByText(rotulo).parentElement!.querySelectorAll("p")[1].textContent;

describe("KPIs do plano mensal", () => {
  test("os quatro cartões, com os rótulos que Definições espera", () => {
    // A escolha de "KPIs no mobile" casa por texto (constants/kpis.ts) e
    // diverge em silêncio — a página cai nos dois primeiros sem erro nenhum.
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000 };
    render(<Planejamento />);

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "planejamento")!.rotulos;
    expect(esperados).toHaveLength(4);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  test("sem total definido: convida a definir, e não inventa números", () => {
    // A primeira vez que a pessoa abre a tela. Zero seria uma resposta errada;
    // ausência de resposta é a resposta certa.
    render(<Planejamento />);

    expect(screen.getByText("Definir")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  test("com total definido e gasto abaixo: sobra dinheiro", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 50000 } };
    despesas = lista([despesa(25000)]);
    render(<Planejamento />);

    expect(screen.getByText("€ 1.000,00")).toBeInTheDocument(); // Total
    expect(screen.getByText("€ 750,00")).toBeInTheDocument(); // Restam
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("gasto exatamente igual ao total: zera, sem ficar negativo", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 100000 } };
    despesas = lista([despesa(100000)]);
    render(<Planejamento />);

    expect(valorDoCard("Restam")).toBe("€ 0,00");
    expect(valorDoCard("% usado")).toBe("100%");
    expect(screen.queryByText("passou do plano")).not.toBeInTheDocument();
  });

  test("gasto acima do total: Restam fica negativo e assume-o", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 200000 } };
    despesas = lista([despesa(130000)]);
    render(<Planejamento />);

    // O sinal fica junto ao número, como `formatCents` faz em todo o app.
    expect(valorDoCard("Restam")).toBe("€ -300,00");
    expect(screen.getByText("passou do plano")).toBeInTheDocument();
    expect(valorDoCard("% usado")).toBe("130%");
  });

  test("só conta o gasto das categorias com teto", () => {
    // 250 € em Alimentação (com teto) e 400 € em Viagens (sem teto). O plano
    // mede 250, não 650 — o que não tem teto não tem plano.
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 50000 } };
    despesas = lista([despesa(25000), despesa(40000, "Viagens")]);
    render(<Planejamento />);

    expect(screen.getByText("€ 750,00")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("Valor/dia divide pelos dias do mês exibido", () => {
    // Agosto tem 31 dias: 310 € / 31 = 10 €.
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 31000 };
    render(<Planejamento />);

    expect(screen.getByText("€ 10,00")).toBeInTheDocument();
    expect(screen.getByText("31 dias no mês")).toBeInTheDocument();
  });
});

describe("folha do total planeado", () => {
  async function abrir() {
    await userEvent.click(screen.getByRole("button", { name: /Total/ }));
  }

  test("mostra a soma dos tetos e o que falta alocar", async () => {
    cfg = {
      ...CONFIG_PADRAO,
      orcamentoTotalMensal: 100000,
      orcamentos: { Alimentação: 40000, Lazer: 25000 },
    };
    render(<Planejamento />);
    await abrir();

    expect(screen.getByText("Soma dos tetos")).toBeInTheDocument();
    expect(screen.getByText("€ 650,00")).toBeInTheDocument();
    expect(screen.getByText("Restante para alocar")).toBeInTheDocument();
    expect(screen.getByText("€ 350,00")).toBeInTheDocument();
  });

  test("tetos somados acima do total: mostra o excesso, não o esconde", async () => {
    // O plano a contradizer-se a si mesmo. Esconder isto deixava a pessoa a
    // repartir dinheiro que já não existe.
    cfg = {
      ...CONFIG_PADRAO,
      orcamentoTotalMensal: 50000,
      orcamentos: { Alimentação: 40000, Lazer: 25000 },
    };
    render(<Planejamento />);
    await abrir();

    expect(screen.getByText("Passou do total em")).toBeInTheDocument();
    expect(screen.getByText("€ 150,00")).toBeInTheDocument();
    expect(screen.queryByText("Restante para alocar")).not.toBeInTheDocument();
  });

  test("sem nenhum teto: o total fica todo por alocar", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000 };
    render(<Planejamento />);
    await abrir();

    expect(screen.getByText(/Nenhuma categoria com teto ainda/)).toBeInTheDocument();
  });

  test("grava o total pelo serviço", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000 };
    render(<Planejamento />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(definirOrcamentoTotal).toHaveBeenCalledWith("u1", 100000);
  });
});

describe("folha do teto de uma categoria", () => {
  test("lista os gastos que compõem o número, e só os dessa categoria", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 50000 } };
    despesas = lista([
      { ...despesa(20000), id: "d1", descricao: "Continente" },
      { ...despesa(5000), id: "d2", descricao: "Padaria" },
      { ...despesa(40000, "Viagens"), id: "d3", descricao: "Comboio" },
    ]);
    render(<Planejamento />);
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));

    expect(screen.getByText("Continente")).toBeInTheDocument();
    expect(screen.getByText("Padaria")).toBeInTheDocument();
    expect(screen.queryByText("Comboio")).not.toBeInTheDocument();
    // O total da lista bate com o gasto que a linha mostra.
    expect(screen.getByText("Gastos que contam para este teto")).toBeInTheDocument();
    expect(screen.getAllByText("€ 250,00").length).toBeGreaterThan(0);
  });

  test("categoria sem nada no mês: diz que está vazia, não fica em branco", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 50000 } };
    render(<Planejamento />);
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));

    expect(screen.getByText(/Nada nesta categoria no mês exibido/)).toBeInTheDocument();
  });
});
