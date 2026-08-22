// @vitest-environment jsdom

// A grade mostra dias fora do mês corrente (fim do anterior, início do
// seguinte) lado a lado com os do mês corrente — dois botões podem ter o
// mesmo número visível. O que se protege aqui é o nome acessível de cada
// dia incluir mês e ano (achado da auditoria de Acessibilidade), para quem
// usa leitor de tela não ouvir só "1" duas vezes sem saber qual é qual.

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));

const SeletorData = (await import("./SeletorData")).default;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // "Hoje" é 18/08 — 15/08 não é hoje nem ontem, então o botão que abre a
  // folha mostra "Escolher data" (e não a data curta) em vez de depender da
  // data real do sistema no dia em que o teste correr.
  vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SeletorData", () => {
  test("o nome acessível de um dia inclui o mês e o ano, não só o número", async () => {
    render(<SeletorData valor="2026-08-15" aoMudar={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "15/08/2026" }));

    expect(screen.getByRole("button", { name: "15 de agosto de 2026" })).toBeInTheDocument();
  });

  test("o dia de hoje é marcado com aria-current, e o escolhido com aria-pressed", async () => {
    render(<SeletorData valor="2026-08-15" aoMudar={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "15/08/2026" }));

    const escolhido = screen.getByRole("button", { name: "15 de agosto de 2026" });
    expect(escolhido).toHaveAttribute("aria-pressed", "true");

    const hoje = screen.getByRole("button", { name: "18 de agosto de 2026" });
    expect(hoje).toHaveAttribute("aria-current", "date");
  });
});
