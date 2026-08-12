// @vitest-environment jsdom

// O Calendário existe para mostrar em que dias há alguma coisa. Os pontos que
// marcam esses dias são desenho (aria-hidden), portanto a informação toda vive
// no nome acessível de cada botão de dia — se ele voltar a ser só o número, o
// ecrã inteiro fica mudo para quem usa leitor de ecrã sem que nada falhe.

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DespesaFixa, EventoCalendario } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/eventosService", () => ({
  criarEvento: vi.fn(async () => {}),
  removerEvento: vi.fn(async () => {}),
}));

let eventos = lista<EventoCalendario>();
let fixas = lista<DespesaFixa>();

vi.mock("../stores/eventosStore", () => ({
  useEventosStore: (s: (e: unknown) => unknown) => s(eventos),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(fixas),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
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
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Calendario = (await import("./Calendario")).default;

beforeEach(() => {
  eventos = lista<EventoCalendario>();
  fixas = lista<DespesaFixa>();
  // Sem relógio fixo, o rótulo do dia de hoje muda conforme o dia em que os
  // testes correm ("Dia 12" vs "Dia 12, hoje") e o ficheiro passa a falhar
  // sozinho amanhã. Só o Date é falseado — não há temporizadores em jogo.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Calendario", () => {
  test("monta e desenha a grelha do mês", () => {
    render(<Calendario />);
    expect(screen.getByRole("heading", { name: "Calendário" })).toBeInTheDocument();
    // Agosto de 2026 tem 31 dias; a grelha traz também dias vizinhos.
    expect(screen.getAllByRole("button", { name: /^Dia \d+/ }).length).toBeGreaterThanOrEqual(31);
  });

  test("um dia sem nada anuncia-se só como o dia", () => {
    render(<Calendario />);
    // Sem vencimentos nem eventos, o nome é apenas "Dia N".
    expect(screen.getByRole("button", { name: "Dia 20" })).toBeInTheDocument();
  });

  test("um dia com vencimento diz que o tem, e quantos", () => {
    // É a informação que os pontos coloridos dão a quem os vê. Sem ela no
    // nome, a grelha era uma lista de números de 1 a 31 e mais nada.
    fixas = lista([
      {
        id: "f1",
        descricao: "Netflix",
        valor: 1590,
        categoria: "Assinaturas",
        diaVencimento: 20,
        pagoPorMes: {},
      } as DespesaFixa,
    ]);
    render(<Calendario />);

    expect(screen.getByRole("button", { name: /Dia 20, 1 vencimento/ })).toBeInTheDocument();
  });

  test("o dia de hoje diz que é hoje, e não só pela cor", () => {
    // "Hoje" distinguia-se apenas por um destaque visual.
    render(<Calendario />);
    expect(screen.getByRole("button", { name: "Dia 12, hoje" })).toBeInTheDocument();
  });

  test("sincronização caída: avisa que o calendário pode estar incompleto", () => {
    eventos = listaComErro<EventoCalendario>();
    render(<Calendario />);
    expect(screen.getByText(/calendário pode estar incompleto/)).toBeInTheDocument();
  });

  test("'Próximos 7 dias' é cabeçalho, para se poder saltar para lá", () => {
    render(<Calendario />);
    expect(screen.getByRole("heading", { name: "Próximos 7 dias" })).toBeInTheDocument();
  });
});
