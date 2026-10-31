// @vitest-environment jsdom

// Parcelas tem uma regra que só se vê a correr: as quitadas saem da lista
// principal e passam a viver numa folha à parte. O risco é a tela ficar a
// dizer "nenhuma compra parcelada" a quem tem dez compras, todas pagas.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DespesaCorrente, Parcela } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

let estado = { itens: [] as Parcela[], carregado: true, erro: false };
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(estado),
}));

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));

vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));

// Fora da fábrica para os testes poderem ler o que foi perguntado ao usuário:
// no caso do "Pagar tudo", o TEXTO da confirmação é a única coisa que separa
// pagar um mês de quitar a compra inteira sem volta.
const confirmar = vi.hoisted(() => vi.fn<(mensagem: string) => Promise<boolean>>(async () => true));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => confirmar }));

const quitarParcela = vi.hoisted(() => vi.fn(async () => {}));
const definirValorDoMes = vi.hoisted(() => vi.fn(async () => {}));
const limparValorDoMes = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../services/parcelasService", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  quitarParcela,
  definirValorDoMes,
  limparValorDoMes,
}));

const Parcelas = (await import("./Parcelas")).default;
const { useDespesasStore } = await import("../stores/lancamentosStore");

/** 300,00 em 3× a começar em junho de 2026. */
const parcela = (extra: Partial<Parcela> = {}): Parcela => ({
  id: "p1",
  descricao: "Portátil",
  total: 30000,
  numParcelas: 3,
  primeiroMes: "2026-06",
  pagoPorMes: {},
  ...extra,
});

/** Todos os meses marcados — a parcela está quitada. */
const quitada = () =>
  parcela({
    id: "p2",
    descricao: "Telemóvel",
    pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
  });

beforeEach(() => {
  estado = { itens: [], carregado: true, erro: false };
  confirmar.mockClear();
  quitarParcela.mockClear();
  definirValorDoMes.mockClear();
  limparValorDoMes.mockClear();
  useDespesasStore.setState({ itens: [], carregado: true, erro: false });
});

describe("Parcelas", () => {
  test("monta e mostra o título", () => {
    render(<Parcelas />);
    expect(screen.getByRole("heading", { name: "Parcelas" })).toBeInTheDocument();
  });

  test("sem nada: mostra o estado vazio", () => {
    render(<Parcelas />);
    expect(screen.getByText("Nenhuma compra em prestações")).toBeInTheDocument();
  });

  test("sincronização caída e sem dados: avisa em vez de dizer que está vazio", () => {
    estado = { itens: [], carregado: true, erro: true };
    render(<Parcelas />);

    expect(screen.queryByText("Nenhuma compra em prestações")).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("com uma parcela em aberto: mostra o nome e o progresso", () => {
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    expect(screen.getByText("Portátil")).toBeInTheDocument();
    // 3 meses, nenhum marcado, mês de referência agosto: 0 de 3 pagas à mão.
    expect(screen.getByText("0/3")).toBeInTheDocument();
  });

  test("tudo quitado NÃO se lê como 'nenhuma compra parcelada'", () => {
    // A distinção que importa: a lista está vazia porque as parcelas mudaram
    // de sítio, não porque não existem. Dizer "nenhuma compra parcelada" a
    // quem acabou de pagar tudo é apagar-lhe o histórico à vista.
    estado = { itens: [quitada()], carregado: true, erro: false };
    render(<Parcelas />);

    expect(screen.queryByText("Nenhuma compra em prestações")).not.toBeInTheDocument();
    expect(screen.getByText(/Tudo liquidado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Liquidadas \(1\)/ })).toBeInTheDocument();
  });

  test("a folha das quitadas abre e mostra lá dentro o que saiu da lista", async () => {
    estado = { itens: [parcela(), quitada()], carregado: true, erro: false };
    render(<Parcelas />);

    // Fora da lista principal enquanto a folha não abre.
    expect(screen.getByText("Portátil")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Liquidadas \(1\)/ }));

    const folha = screen.getByRole("dialog", { name: /Liquidadas/ });
    expect(folha).toBeInTheDocument();
    expect(screen.getByText("Telemóvel")).toBeInTheDocument();
  });

  // Item 2 do lote de UX/nav (30/08): "Pagar {mês}" e "Pagar tudo" deixaram
  // de ser botões soltos ao lado do corpo — moraram pro menu único, que abre
  // ao tocar na linha (junto de Editar/Excluir).
  test("o menu da linha oferece pagar um mês ou tudo, lado a lado", async () => {
    // Antes eram "Pagar julho" e "Quitar", sem nada que dissesse que o
    // segundo lança a compra toda de uma vez e não tem volta.
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    await userEvent.click(screen.getByText("Portátil"));

    // Junho é o primeiro mês em aberto desta parcela — o botão paga ESSE mês.
    expect(await screen.findByRole("button", { name: "Pagar junho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar tudo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  test("o menu da linha também oferece Editar e Eliminar", async () => {
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    await userEvent.click(screen.getByText("Portátil"));

    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  test("pagar tudo avisa que quita a compra inteira e não dá para desfazer", async () => {
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    await userEvent.click(screen.getByText("Portátil"));
    await userEvent.click(await screen.findByRole("button", { name: "Pagar tudo" }));

    const [texto] = confirmar.mock.calls[0];
    expect(texto).toContain("€ 300,00");
    expect(texto).toMatch(/não dá para desfazer/i);
    expect(quitarParcela).toHaveBeenCalledTimes(1);
  });

  test("a folha fechada não deixa o Tab entrar nos botões dela", () => {
    // A folha continua montada depois da primeira abertura; é o `inert` que
    // impede o Tab de a alcançar. Sem ele, tabular na página levava o foco a
    // botões invisíveis — o defeito que o passe de acessibilidade corrigiu.
    estado = { itens: [parcela(), quitada()], carregado: true, erro: false };
    render(<Parcelas />);

    const folha = screen.getByRole("dialog", { hidden: true, name: /Liquidadas/ });
    expect(folha).toHaveAttribute("inert");
  });

  test("erro de validação associa os campos relevantes via aria-describedby — achado da auditoria de Acessibilidade", async () => {
    render(<Parcelas />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar parcela" }));

    await userEvent.type(screen.getByLabelText("Descrição"), "Portátil");
    await userEvent.type(screen.getByLabelText("Quanto no total?"), "50000");
    // Nº parcelas já nasce em "3", válido — não precisa mexer.
    // "Dia do vencimento" não tem min/max no HTML — é o único jeito de
    // chegar ao erro de JS sem o navegador bloquear o submit antes.
    await userEvent.type(screen.getByLabelText("Dia do vencimento"), "99");
    await userEvent.click(screen.getByRole("button", { name: "Criar parcela" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Dia do vencimento deve ser entre 1 e 31.");

    const idErro = alerta.id;
    expect(idErro).toBeTruthy();
    expect(screen.getByLabelText("Quanto no total?")).toHaveAttribute("aria-describedby", idErro);
    expect(screen.getByLabelText("Nº parcelas")).toHaveAttribute("aria-describedby", idErro);
    expect(screen.getByLabelText("Dia do vencimento")).toHaveAttribute("aria-describedby", idErro);
  });

  // Klarna às vezes cobra parcelas desiguais (160,75 em 3× → 53,33 + 53,71 +
  // 53,71): a folha "Ajustar valores por mês" acerta o valor de cada mês
  // ANTES de pagar, para a despesa nascer com o valor certo.
  describe("Ajustar valores por mês", () => {
    /** Junho já pago; julho e agosto em aberto. */
    const comJunhoPago = (extra: Partial<Parcela> = {}) =>
      parcela({ pagoPorMes: { "2026-06": true }, ...extra });

    async function abrirFolha() {
      await userEvent.click(screen.getByText("Portátil"));
      await userEvent.click(await screen.findByRole("button", { name: "Ajustar valores por mês" }));
      return screen.findByRole("dialog", { name: /Valores por mês/ });
    }

    test("abre a partir do menu da linha e lista todos os meses do plano", async () => {
      estado = { itens: [comJunhoPago()], carregado: true, erro: false };
      render(<Parcelas />);
      const folha = await abrirFolha();
      expect(within(folha).getByText(/junho/i)).toBeInTheDocument();
      expect(within(folha).getByLabelText(/Valor de julho/i)).toBeInTheDocument();
      expect(within(folha).getByLabelText(/Valor de agosto/i)).toBeInTheDocument();
    });

    test("não aparece no menu de uma parcela quitada", async () => {
      estado = { itens: [quitada()], carregado: true, erro: false };
      render(<Parcelas />);
      await userEvent.click(screen.getByRole("button", { name: /Liquidadas/ }));
      await userEvent.click(await screen.findByText("Telemóvel"));
      expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Ajustar valores por mês" }),
      ).not.toBeInTheDocument();
    });

    test("editar o valor de um mês em aberto grava pelo serviço", async () => {
      estado = { itens: [comJunhoPago()], carregado: true, erro: false };
      render(<Parcelas />);
      const folha = await abrirFolha();

      const campo = within(folha).getByLabelText(/Valor de julho/i);
      await userEvent.type(campo, "{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}9500");
      await userEvent.click(within(folha).getByRole("button", { name: /Guardar julho/i }));

      expect(definirValorDoMes).toHaveBeenCalledTimes(1);
      expect(definirValorDoMes).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ id: "p1" }),
        "2026-07",
        9500,
        [],
      );
    });

    test("'Usar valor automático' só aparece no mês com ajuste, e limpa-o", async () => {
      estado = {
        itens: [comJunhoPago({ overridePorMes: { "2026-08": 9500 } })],
        carregado: true,
        erro: false,
      };
      render(<Parcelas />);
      const folha = await abrirFolha();

      const botoes = within(folha).getAllByRole("button", { name: /Usar valor automático/ });
      expect(botoes).toHaveLength(1);
      expect(botoes[0]).toHaveAccessibleName(/agosto/i);

      await userEvent.click(botoes[0]);
      expect(limparValorDoMes).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ id: "p1" }),
        "2026-08",
        [],
      );
    });

    /** A despesa que `pagarMesParcela` criou para junho. */
    const espelhoJunho: DespesaCorrente = {
      id: "d1",
      descricao: "Portátil",
      valor: 10000,
      data: "2026-06-10",
      categoria: "Parcelas",
      origem: "parc",
      parcelaId: "p1",
      parcelaMes: "2026-06",
    };

    test("mês pago também é editável e guardar repassa as despesas ao serviço", async () => {
      useDespesasStore.setState({ itens: [espelhoJunho] });
      estado = { itens: [comJunhoPago()], carregado: true, erro: false };
      render(<Parcelas />);
      const folha = await abrirFolha();

      const campo = within(folha).getByLabelText(/Valor de junho/i);
      await userEvent.type(campo, "{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}5333");
      await userEvent.click(within(folha).getByRole("button", { name: /Guardar junho/i }));

      expect(definirValorDoMes).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ id: "p1" }),
        "2026-06",
        5333,
        [espelhoJunho],
      );
    });

    test("mês pago com despesa espelho avisa que o lançamento é corrigido junto", async () => {
      useDespesasStore.setState({ itens: [espelhoJunho] });
      estado = { itens: [comJunhoPago()], carregado: true, erro: false };
      render(<Parcelas />);
      const folha = await abrirFolha();

      expect(
        within(folha).getByText(/também corrige o lançamento em Despesas/i),
      ).toBeInTheDocument();
    });

    test("mês pago por débito direto, sem espelho: avisa que a fatura não muda", async () => {
      estado = {
        // 6 meses: o débito automático já cobrou junho e julho, mas a compra
        // continua ativa (com 3 meses ficava toda quitada e saía da lista).
        itens: [parcela({ autoDebit: true, cartao: "c1", numParcelas: 6, total: 60000 })],
        carregado: true,
        erro: false,
      };
      render(<Parcelas />);
      const folha = await abrirFolha();

      expect(within(folha).getByLabelText(/Valor de junho/i)).toBeInTheDocument();
      expect(within(folha).getAllByText(/via débito direto/i).length).toBeGreaterThan(0);
      expect(within(folha).queryByText(/também corrige o lançamento/i)).not.toBeInTheDocument();
    });

    test("'Usar valor automático' num mês pago repassa as despesas ao serviço", async () => {
      useDespesasStore.setState({ itens: [espelhoJunho] });
      estado = {
        itens: [comJunhoPago({ overridePorMes: { "2026-06": 5333 } })],
        carregado: true,
        erro: false,
      };
      render(<Parcelas />);
      const folha = await abrirFolha();

      await userEvent.click(
        within(folha).getByRole("button", { name: /Usar valor automático em junho/i }),
      );
      expect(limparValorDoMes).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ id: "p1" }),
        "2026-06",
        [espelhoJunho],
      );
    });

    test("soma dos meses diferente do total avisa, sem impedir de guardar", async () => {
      estado = {
        itens: [comJunhoPago({ overridePorMes: { "2026-08": 9500 } })],
        carregado: true,
        erro: false,
      };
      render(<Parcelas />);
      const folha = await abrirFolha();

      expect(within(folha).getByText(/abaixo do total da compra/i)).toBeInTheDocument();
      const campo = within(folha).getByLabelText(/Valor de julho/i);
      await userEvent.type(campo, "1");
      expect(within(folha).getByRole("button", { name: /Guardar julho/i })).toBeEnabled();
    });
  });
});
