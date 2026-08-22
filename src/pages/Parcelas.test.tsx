// @vitest-environment jsdom

// Parcelas tem uma regra que só se vê a correr: as quitadas saem da lista
// principal e passam a viver numa folha à parte. O risco é a tela ficar a
// dizer "nenhuma compra parcelada" a quem tem dez compras, todas pagas.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Parcela } from "../types";
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
vi.mock("../services/parcelasService", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  quitarParcela,
}));

const Parcelas = (await import("./Parcelas")).default;

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
});

describe("Parcelas", () => {
  test("monta e mostra o título", () => {
    render(<Parcelas />);
    expect(screen.getByRole("heading", { name: "Parcelas" })).toBeInTheDocument();
  });

  test("sem nada: mostra o estado vazio", () => {
    render(<Parcelas />);
    expect(screen.getByText("Nenhuma compra parcelada")).toBeInTheDocument();
  });

  test("sincronização caída e sem dados: avisa em vez de dizer que está vazio", () => {
    estado = { itens: [], carregado: true, erro: true };
    render(<Parcelas />);

    expect(screen.queryByText("Nenhuma compra parcelada")).not.toBeInTheDocument();
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

    expect(screen.queryByText("Nenhuma compra parcelada")).not.toBeInTheDocument();
    expect(screen.getByText(/Tudo quitado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quitadas \(1\)/ })).toBeInTheDocument();
  });

  test("a folha das quitadas abre e mostra lá dentro o que saiu da lista", async () => {
    estado = { itens: [parcela(), quitada()], carregado: true, erro: false };
    render(<Parcelas />);

    // Fora da lista principal enquanto a folha não abre.
    expect(screen.getByText("Portátil")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Quitadas \(1\)/ }));

    const folha = screen.getByRole("dialog", { name: /Quitadas/ });
    expect(folha).toBeInTheDocument();
    expect(screen.getByText("Telemóvel")).toBeInTheDocument();
  });

  test("os dois botões da linha dizem-se ao lado um do outro: um mês ou tudo", () => {
    // Lado a lado estavam "Pagar julho" e "Quitar", sem nada que dissesse que
    // o segundo lança a compra toda de uma vez e não tem volta.
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    // Junho é o primeiro mês em aberto desta parcela — o botão paga ESSE mês.
    expect(screen.getByRole("button", { name: "Pagar junho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar tudo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  test("pagar tudo avisa que quita a compra inteira e não dá para desfazer", async () => {
    estado = { itens: [parcela()], carregado: true, erro: false };
    render(<Parcelas />);

    await userEvent.click(screen.getByRole("button", { name: "Pagar tudo" }));

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

    const folha = screen.getByRole("dialog", { hidden: true, name: /Quitadas/ });
    expect(folha).toHaveAttribute("inert");
  });

  test("erro de validação associa os campos relevantes via aria-describedby — achado da auditoria de Acessibilidade", async () => {
    render(<Parcelas />);
    await userEvent.click(screen.getByRole("button", { name: "Nova parcela" }));

    await userEvent.type(screen.getByLabelText("Nome"), "Portátil");
    await userEvent.type(screen.getByLabelText("Total (€)"), "50000");
    // Nº parcelas já nasce em "3", válido — não precisa mexer.
    // "Dia do vencimento" não tem min/max no HTML — é o único jeito de
    // chegar ao erro de JS sem o navegador bloquear o submit antes.
    await userEvent.type(screen.getByLabelText("Dia do vencimento"), "99");
    await userEvent.click(screen.getByRole("button", { name: "Criar parcela" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Dia do vencimento deve ser entre 1 e 31.");

    const idErro = alerta.id;
    expect(idErro).toBeTruthy();
    expect(screen.getByLabelText("Total (€)")).toHaveAttribute("aria-describedby", idErro);
    expect(screen.getByLabelText("Nº parcelas")).toHaveAttribute("aria-describedby", idErro);
    expect(screen.getByLabelText("Dia do vencimento")).toHaveAttribute("aria-describedby", idErro);
  });
});
