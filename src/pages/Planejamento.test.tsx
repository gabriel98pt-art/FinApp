// @vitest-environment jsdom

// Planejamento é a página do plano inteiro, em duas abas:
//
//  - **Orçamento** (era a tela "Planejamento"): os quatro cartões do plano do
//    mês e o OrcamentoCard, onde os tetos por categoria se definem. O que se
//    testa do cartão são sobretudo as linhas de categoria, que são botões.
//  - **Metas** (era a tela "Metas"): o cartão da meta do mês (atingida ou não)
//    e a lista de fundos de poupança. O que interessa proteger é a mesma
//    distinção de sempre — "ainda não sabemos" não pode aparecer como "não tens
//    nada" — e o selo de meta atingida, que muda de cor e de texto conforme o
//    saldo.
//
// Os testes das duas abas vivem juntos porque a página é uma só: qualquer um
// deles tem de começar por garantir que está na aba certa.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DespesaCorrente, Fundo, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";
import { KPIS_POR_PAGINA } from "../constants/kpis";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
const definirOrcamentoTotal = vi.fn(async () => {});
vi.mock("../services/cfgService", () => ({
  definirOrcamento: vi.fn(async () => {}),
  definirOrcamentoTotal: (...a: unknown[]) => definirOrcamentoTotal(...(a as [])),
}));
vi.mock("../services/fundosService", () => ({
  criarFundo: vi.fn(async () => {}),
  contribuirFundo: vi.fn(async () => {}),
  atualizarFundo: vi.fn(async () => {}),
  removerFundo: vi.fn(async () => {}),
}));

let despesas = lista<DespesaCorrente>();
let receitas = lista<Receita>();
let fundos = lista<Fundo>();
let cfg = { ...CONFIG_PADRAO };
// Mutável: um teste precisa de um mês visível DIFERENTE do mês real para
// apanhar o cartão da meta a rotular-se com o mês errado.
let mesVisivel = "2026-08";

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
vi.mock("../stores/fundosStore", () => ({
  useFundosStore: (s: (e: unknown) => unknown) => s(fundos),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: mesVisivel }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Planejamento = (await import("./Planejamento")).default;

// A página usa `useLocation` (a aba inicial pode vir do state da navegação,
// que é como /metas cai na aba certa) — precisa de um Router à volta.
function montar() {
  return render(
    <MemoryRouter>
      <Planejamento />
    </MemoryRouter>,
  );
}

/** Monta já na aba Metas — o mesmo que chegar por /metas. */
async function montarNasMetas() {
  montar();
  await userEvent.click(screen.getByRole("tab", { name: "Metas" }));
}

const despesa = (valor: number, categoria = "Alimentação"): DespesaCorrente =>
  ({
    id: `d${valor}`,
    descricao: "Mercado",
    valor,
    data: "2026-08-03",
    categoria,
  }) as DespesaCorrente;

const fundo = (extra: Partial<Fundo> = {}): Fundo => ({
  id: "fu1",
  nome: "Viagem",
  atual: 50000,
  alvo: 200000,
  ...extra,
});

beforeEach(() => {
  despesas = lista<DespesaCorrente>();
  receitas = lista<Receita>();
  fundos = lista<Fundo>();
  cfg = { ...CONFIG_PADRAO };
  mesVisivel = "2026-08";
  definirOrcamentoTotal.mockClear();
});

describe("Planejamento", () => {
  test("monta e mostra o título", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
  });

  test("tem as duas abas do plano, e abre no Orçamento", () => {
    // Orçamento primeiro porque é o teto que manda: a meta de poupança é o que
    // sobra depois dele.
    montar();

    expect(screen.getByRole("tab", { name: "Orçamento" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Metas" })).toHaveAttribute("aria-selected", "false");
  });

  test("a aba Metas troca o conteúdo, sem sair da página", async () => {
    montar();
    await userEvent.click(screen.getByRole("tab", { name: "Metas" }));

    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
    expect(screen.getByText("Nenhum fundo criado")).toBeInTheDocument();
    // O conteúdo da outra aba sai de cena.
    expect(screen.queryByText(/Defina um teto mensal por categoria/)).not.toBeInTheDocument();
  });
});

describe("aba Orçamento — tetos por categoria", () => {
  test("sem tectos definidos: convida a definir o primeiro", () => {
    montar();
    expect(screen.getByText(/Defina um teto mensal por categoria/)).toBeInTheDocument();
  });

  test("com teto: mostra a categoria, a percentagem gasta e é clicável", () => {
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 40000 } };
    despesas = lista([despesa(10000)]);
    montar();

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
    montar();

    const linha = screen.getByRole("button", { name: /Alimentação/ });
    expect(linha.querySelector("div")).toBeNull();
  });

  test("estouro do teto aparece como selo, não só como cor", () => {
    // A cor sozinha não chega a quem não a distingue.
    cfg = { ...CONFIG_PADRAO, orcamentos: { Alimentação: 10000 } };
    despesas = lista([despesa(15000)]);
    montar();

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
    montar();

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "planejamento")!.rotulos;
    expect(esperados).toHaveLength(4);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  test("sem total definido: convida a definir, e não inventa números", () => {
    // A primeira vez que a pessoa abre a tela. Zero seria uma resposta errada;
    // ausência de resposta é a resposta certa.
    montar();

    expect(screen.getByText("Definir")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  test("com total definido e gasto abaixo: sobra dinheiro", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 50000 } };
    despesas = lista([despesa(25000)]);
    montar();

    expect(screen.getByText("€ 1.000,00")).toBeInTheDocument(); // Total
    expect(screen.getByText("€ 750,00")).toBeInTheDocument(); // Restam
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("gasto exatamente igual ao total: zera, sem ficar negativo", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 100000 } };
    despesas = lista([despesa(100000)]);
    montar();

    expect(valorDoCard("Restam")).toBe("€ 0,00");
    expect(valorDoCard("% usado")).toBe("100%");
    expect(screen.queryByText("passou do plano")).not.toBeInTheDocument();
  });

  test("gasto acima do total: Restam fica negativo e assume-o", () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000, orcamentos: { Alimentação: 200000 } };
    despesas = lista([despesa(130000)]);
    montar();

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
    montar();

    expect(screen.getByText("€ 750,00")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("Valor/dia divide pelos dias do mês exibido", () => {
    // Agosto tem 31 dias: 310 € / 31 = 10 €.
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 31000 };
    montar();

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
    montar();
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
    montar();
    await abrir();

    expect(screen.getByText("Passou do total em")).toBeInTheDocument();
    expect(screen.getByText("€ 150,00")).toBeInTheDocument();
    expect(screen.queryByText("Restante para alocar")).not.toBeInTheDocument();
  });

  test("sem nenhum teto: o total fica todo por alocar", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000 };
    montar();
    await abrir();

    expect(screen.getByText(/Nenhuma categoria com teto ainda/)).toBeInTheDocument();
  });

  test("grava o total pelo serviço", async () => {
    cfg = { ...CONFIG_PADRAO, orcamentoTotalMensal: 100000 };
    montar();
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
    montar();
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
    montar();
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));

    expect(screen.getByText(/Nada nesta categoria no mês exibido/)).toBeInTheDocument();
  });
});

describe("aba Metas", () => {
  test("os quatro cartões, com os rótulos que Definições espera", async () => {
    // Mesma armadilha da outra aba: a escolha de "KPIs no mobile" casa por
    // texto, e o `id` continua a ser "metas" mesmo depois da fusão — é o que
    // deixa a escolha já gravada continuar a casar.
    await montarNasMetas();

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "metas")!.rotulos;
    expect(esperados).toHaveLength(4);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });

  test("sem fundos: estado vazio que ensina como criar o primeiro", async () => {
    await montarNasMetas();
    expect(screen.getByText("Nenhum fundo criado")).toBeInTheDocument();
  });

  test("sincronização caída e sem fundos: avisa em vez de dizer que está vazio", async () => {
    fundos = listaComErro<Fundo>();
    await montarNasMetas();

    expect(screen.queryByText("Nenhum fundo criado")).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("com fundos: mostra o nome e a faixa fina se a sincronização caiu", async () => {
    fundos = listaComErro([fundo()]);
    await montarNasMetas();

    expect(screen.getByText("Viagem")).toBeInTheDocument();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("o cartão da meta é rotulado com o mês que gerou os números", async () => {
    // Bug: o título usava o mês REAL e os números o mês do seletor. Com julho
    // escolhido, lia-se "Meta — Agosto 2026" por cima do saldo de julho.
    mesVisivel = "2026-07";
    await montarNasMetas();

    expect(screen.getByText("Meta — julho 2026")).toBeInTheDocument();
  });

  test("a percentagem do fundo aparece em texto, não só na barra", async () => {
    // As barras aqui são divs sem role de progresso, de propósito: o número já
    // está escrito ao lado. Se deixasse de estar, a barra passava a ser a única
    // fonte da informação e ficava invisível para quem usa leitor de ecrã.
    fundos = lista([fundo()]);
    await montarNasMetas();

    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  test("o quadro de 12 meses diz a janela que soma", async () => {
    // Havia dois "Resumo Anual" no app — este, de 12 meses móveis, e o do
    // Início, de 6 meses ancorados no mês do seletor. Mesmo título, totais
    // diferentes, nada a explicar porquê. Agora cada um diz a sua janela.
    await montarNasMetas();

    expect(screen.getByRole("heading", { name: "Últimos 12 meses" })).toBeInTheDocument();
    expect(screen.queryByText("Resumo Anual")).not.toBeInTheDocument();
  });
});
