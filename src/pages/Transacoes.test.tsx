// @vitest-environment jsdom

// Transações é o extrato que junta seis domínios. O teste que interessa aqui
// é o do estado de erro: esta página chegou a afirmar "Nada movimentado em
// <mês>" quando o que havia era falha de rede, porque o syncService marca
// `carregado: true` junto com `erro: true`. A regressão é silenciosa — a tela
// fica bonita e mente —, por isso fica presa por teste.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ConfigConta, DespesaCorrente, Receita } from "../types";
import { comInstituicoes, instituicao } from "../testes/instituicoes";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const removerReceita = vi.hoisted(() => vi.fn(async () => {}));
const removerDespesa = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../services/lancamentosService", () => ({
  criarDespesa: vi.fn(async () => {}),
  removerReceita,
  removerDespesa,
}));
vi.mock("../services/veiculoService", () => ({ removerCarga: vi.fn(async () => {}) }));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

/** Estado de uma store de lista, com tudo carregado e sem erro por omissão. */
const lista = <T,>(itens: T[] = []) => ({ itens, carregado: true, erro: false });

let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();
let vazias = lista();

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(vazias),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(vazias),
}));

vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(vazias),
}));

const SEM_VEICULO = { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] };
let veiculoDados: unknown = SEM_VEICULO;
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s({ dados: veiculoDados, ...vazias }),
}));

let cfg: ConfigConta = CONFIG_PADRAO;

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));

vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));

vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) => s({ abrirRegistro: vi.fn() }),
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));

const Transacoes = (await import("./Transacoes")).default;

const desenhar = () =>
  render(
    <MemoryRouter>
      <Transacoes />
    </MemoryRouter>,
  );

beforeEach(() => {
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  veiculoDados = SEM_VEICULO;
  vazias = lista();
  cfg = CONFIG_PADRAO;
  removerReceita.mockClear();
  removerDespesa.mockClear();
});

describe("Transacoes", () => {
  test("uma despesa antiga mostra o nome de hoje da conta, não o de quando foi lançada", () => {
    // A despesa guarda "AB Gold (C)", o id que ficou de antes do rename. É a
    // razão de a cascata de renomear ter podido desaparecer: o extrato resolve
    // o nome na hora, em vez de o histórico ter de ser reescrito.
    cfg = {
      ...CONFIG_PADRAO,
      ...comInstituicoes(instituicao("Gold Novo", "credito", { id: "AB Gold (C)" })),
    };
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4200,
        data: "2026-08-10",
        categoria: "Alimentação",
        contaCartao: "AB Gold (C)",
      },
    ]);
    desenhar();

    expect(screen.getByText(/Gold Novo/)).toBeInTheDocument();
    expect(screen.queryByText(/AB Gold \(C\)/)).toBeNull();
  });

  test("o extrato agrupa por dia; o total do dia é o líquido e só aparece com 2+ movimentos", () => {
    receitas = lista<Receita>([
      { id: "r1", descricao: "Salário", valor: 185000, data: "2026-08-03", fonte: "Trabalho" },
    ] as Receita[]);
    despesas = lista<DespesaCorrente>([
      { id: "d1", descricao: "Mercado", valor: 4250, data: "2026-08-03", categoria: "Alimentação" },
      { id: "d2", descricao: "Cinema", valor: 1800, data: "2026-08-10", categoria: "Lazer" },
    ] as DespesaCorrente[]);
    desenhar();

    const dias = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(dias).toEqual(["Segunda, 10 ago", "Segunda, 3 ago"]);

    // Dia 3: entrou 1850,00 e saiu 42,50 → +€ 1.807,50 (líquido).
    const dia3 = screen.getByRole("heading", { name: "Segunda, 3 ago" }).parentElement!;
    expect(within(dia3).getByText("+€ 1.807,50")).toBeInTheDocument();
    // Dia 10: um movimento só — só a data, o valor fica na linha.
    const dia10 = screen.getByRole("heading", { name: "Segunda, 10 ago" }).parentElement!;
    expect(dia10.textContent).toBe("Segunda, 10 ago");
  });

  test("o extrato é uma secção sem cartão: a contagem faz de título", () => {
    despesas = lista<DespesaCorrente>([
      { id: "d1", descricao: "Mercado", valor: 4250, data: "2026-08-03", categoria: "Alimentação" },
    ] as DespesaCorrente[]);
    desenhar();

    const secao = screen.getByRole("region", { name: "Extrato" });
    expect(within(secao).getByRole("heading", { name: "1 transações" })).toBeInTheDocument();
  });

  test("monta e mostra a secção do extrato", () => {
    desenhar();
    expect(screen.getByRole("region", { name: "Extrato" })).toBeInTheDocument();
  });

  test("mês realmente sem movimento: pode afirmar que está vazio", () => {
    desenhar();
    expect(screen.getByText(/Nada movimentado em agosto 2026/)).toBeInTheDocument();
  });

  test("sincronização caída e sem dados: NÃO diz que nada foi movimentado", () => {
    // O defeito que este ficheiro existe para travar. Sem dados e com a
    // subscrição caída, "Nada movimentado" é uma afirmação categórica sobre
    // dados que nunca chegaram — num app de dinheiro lê-se como perda de
    // registos, não como problema de rede.
    receitas = { ...lista<Receita>(), erro: true };
    desenhar();

    expect(screen.queryByText(/Nada movimentado/)).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("basta UM domínio em erro para o aviso aparecer", () => {
    // O extrato junta seis. Se só se olhasse ao primeiro, uma falha no veículo
    // ou nas parcelas passava em claro e o total ficava menor sem aviso.
    vazias = { ...lista(), erro: true }; // fixas, transferências, parcelas e veículo
    desenhar();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("com linhas no ecrã, o aviso é a faixa fina e as linhas ficam", () => {
    receitas = { itens: [receita()], carregado: true, erro: true };
    desenhar();

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("junta receitas e despesas no mesmo extrato, com os sinais certos", () => {
    receitas = lista([receita()]);
    despesas = lista([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("2 transações")).toBeInTheDocument();
  });

  describe("pesquisa e limpar tudo", () => {
    const duas = () => {
      receitas = lista([receita()]);
      despesas = lista([
        {
          id: "d1",
          descricao: "Café da Avó",
          valor: 450,
          data: "2026-08-03",
          categoria: "Alimentação",
        } as DespesaCorrente,
      ]);
    };

    test("pesquisar por descrição ignora acentos e mostra só o que bate", async () => {
      duas();
      desenhar();
      await userEvent.type(screen.getByRole("searchbox", { name: "Pesquisar transações" }), "cafe");
      expect(screen.getByText("Café da Avó")).toBeInTheDocument();
      expect(screen.queryByText("Salário")).toBeNull();
      expect(screen.getByText("1 de 2 transações")).toBeInTheDocument();
    });

    test("sem resultado: diz que nada bate e Limpar tudo traz a lista de volta", async () => {
      duas();
      desenhar();
      await userEvent.type(screen.getByRole("searchbox", { name: "Pesquisar transações" }), "zzz");
      expect(screen.getByText("Nenhuma transação com esse filtro")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
      expect(screen.getByText("Salário")).toBeInTheDocument();
      expect(screen.getByText("Café da Avó")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Limpar tudo" })).toBeNull();
    });

    test("o período corta pelas datas dentro do mês", async () => {
      duas();
      desenhar();
      await userEvent.click(screen.getByRole("button", { name: "Filtrar transações" }));
      const ate = screen.getByLabelText("Até");
      fireEvent.change(ate, { target: { value: "2026-08-03" } });
      expect(screen.getByText("Café da Avó")).toBeInTheDocument();
      expect(screen.queryByText("Salário")).toBeNull();
    });
  });

  test("o pagamento de uma fatura traz a etiqueta «Pagamento de fatura»", () => {
    despesas = lista([
      {
        id: "f1",
        descricao: "Cartão de Crédito Visa",
        valor: 15000,
        data: "2026-08-05",
        categoria: "Cartão de Crédito",
        contaCartao: "Conta",
        origem: "fat",
        nota: "Ref. 2026-08",
      } as DespesaCorrente,
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();
    expect(screen.getByText(/^Pagamento de fatura/)).toBeInTheDocument();
    // Um gasto normal continua com a sua categoria.
    expect(screen.getByText(/^Alimentação/)).toBeInTheDocument();
  });

  test("uma carga a combustível diz «Carga», uma elétrica «Carga Elétrica»", () => {
    veiculoDados = {
      cargas: [
        { id: "c1", data: "2026-08-04", litros: 40, precoLitro: 165, custo: 6600, local: "Galp" },
        { id: "c2", data: "2026-08-05", kwh: 30, precoKwh: 20, custo: 600, local: "Casa" },
      ],
      despesas: [],
      despesasFixas: [],
      quilometragem: [],
    } as never;
    desenhar();
    expect(screen.getByText(/^Carga ·|^Carga$/)).toBeInTheDocument();
    expect(screen.getByText(/^Carga Elétrica/)).toBeInTheDocument();
  });

  test("reembolso mostra o sinal UMA vez, do lado de quem recebe", () => {
    // Um reembolso é uma despesa de valor NEGATIVO (utils/reembolsos.ts). A
    // linha somava o prefixo da direção ao menos do próprio número e saía
    // "− € -75,00". Dinheiro que voltou é entrada: "+", e o módulo do valor.
    despesas = lista([
      {
        id: "d1",
        descricao: "Jantar de grupo",
        valor: 12000,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
      {
        id: "d2",
        descricao: "Reembolso do jantar",
        valor: -7500,
        data: "2026-08-04",
        categoria: "Alimentação",
        origem: "reemb",
        reembolsoDeId: "d1",
      } as DespesaCorrente,
    ]);
    const { container } = desenhar();

    expect(container.textContent).toContain("+€ 75,00");
    // A saída antiga, letra por letra — o menos duas vezes.
    expect(container.textContent).not.toContain("−€ -75,00");
  });
});

// Item 2 do lote de UX/nav (30/08): receita/despesa ganham o menu único
// (Editar/Excluir) — os outros cinco tipos continuam na folha "Abrir em X".
describe("menu de ações da linha (item 2)", () => {
  test("tocar numa linha de receita abre o menu com Editar e Eliminar", async () => {
    receitas = lista([receita()]);
    desenhar();

    await userEvent.click(screen.getByText("Salário"));

    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  test("Eliminar no menu remove a receita direto, sem abrir formulário", async () => {
    receitas = lista([receita()]);
    desenhar();

    await userEvent.click(screen.getByText("Salário"));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(removerReceita).toHaveBeenCalledWith("u1", "r1"));
  });

  test("Eliminar no menu remove a despesa direto", async () => {
    despesas = lista([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();

    await userEvent.click(screen.getByText("Mercado"));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(removerDespesa).toHaveBeenCalledWith("u1", "d1"));
  });
});

// 01/09: o extrato era a última lista grande do app a desenhar tudo de uma
// vez. Junta seis domínios do mês, então cem linhas num mês normal é comum.
describe("paginação do extrato (01/09)", () => {
  /** N despesas do mesmo dia, "Compra 01", "Compra 02", …
   *
   *  Ids com zero à frente de propósito: no mesmo dia o extrato desempata
   *  pelo id em ordem alfabética (`utils/transacoes.ts`), e sem o zero "d10"
   *  vinha antes de "d2". Com o zero, a ordem na tela é a numérica. */
  const compras = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const num = String(i + 1).padStart(2, "0");
      return {
        id: `d${num}`,
        descricao: `Compra ${num}`,
        valor: 1000 + i,
        data: "2026-08-10",
        categoria: i === 0 ? "Transporte" : "Alimentação",
      } as DespesaCorrente;
    });

  test("com 15 ou menos, nada de paginador — não há o que navegar", () => {
    despesas = lista(compras(15));
    desenhar();

    expect(screen.getByText("Compra 15")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Página seguinte" })).toBeNull();
  });

  test("com mais de 15, mostra as 15 primeiras e o paginador", () => {
    despesas = lista(compras(20));
    desenhar();

    expect(screen.getByText("Compra 01")).toBeInTheDocument();
    expect(screen.getByText("Compra 15")).toBeInTheDocument();
    expect(screen.queryByText("Compra 16")).toBeNull();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // A contagem do cabeçalho continua a ser do mês inteiro, não da página.
    expect(screen.getByText("20 transações")).toBeInTheDocument();
  });

  test("a página seguinte mostra o resto", async () => {
    despesas = lista(compras(20));
    desenhar();

    await userEvent.click(screen.getByRole("button", { name: "Página seguinte" }));

    expect(screen.getByText("Compra 16")).toBeInTheDocument();
    expect(screen.queryByText("Compra 01")).toBeNull();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  test("filtrar volta à página 1 em vez de deixar a tela vazia", async () => {
    // O defeito que a `key` evita: estando na página 2 e filtrando para uma
    // categoria com uma linha só, a página 2 dessa lista não existe.
    despesas = lista(compras(20));
    desenhar();

    await userEvent.click(screen.getByRole("button", { name: "Página seguinte" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Filtrar/ }));
    await userEvent.click(await screen.findByRole("radio", { name: /Transporte/ }));

    // "Compra 01" é a única de Transporte — e tem de estar à vista.
    expect(screen.getByText("Compra 01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Página seguinte" })).toBeNull();
  });
});

function receita(): Receita {
  return {
    id: "r1",
    descricao: "Salário",
    valor: 185000,
    data: "2026-08-05",
    fonte: "Trabalho",
  };
}
