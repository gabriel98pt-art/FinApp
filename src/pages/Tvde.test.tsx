// @vitest-environment jsdom

// TVDE é o módulo com moeda FIXA em euros — não segue a moeda da conta. Isso
// e as quatro abas são o que este smoke segura.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DadosTvde } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/tvdeService", () => ({
  criarDespesaTvde: vi.fn(async () => {}),
  definirSegMes: vi.fn(async () => {}),
  desfazerLancamentoSemana: vi.fn(async () => {}),
  lancarReceitaSemana: vi.fn(async () => {}),
  removerDespesaTvde: vi.fn(async () => {}),
  removerSemana: vi.fn(async () => {}),
  salvarSemana: vi.fn(async () => {}),
}));

/** A forma tem de bater com a de TVDE_VAZIO no serviço: `segPorMes` (não
 *  `segSocial`) e `despesas` como ARRAY. Errar isto rebentava a página inteira
 *  com "Cannot convert undefined or null to object", que não diz qual campo é. */
const vazio = (): DadosTvde =>
  ({
    cfg: { inicioSemana1: "2026-01-05", aluguel: 0, pctFrota: 0 },
    semanas: {},
    segPorMes: {},
    lancamentos: {},
    despesas: [],
  }) as unknown as DadosTvde;

let dados = vazio();
let erro = false;

vi.mock("../stores/tvdeStore", () => ({
  useTvdeStore: (s: (e: unknown) => unknown) => s({ dados, carregado: true, erro }),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
let cfg = CONFIG_PADRAO;

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Tvde = (await import("./Tvde")).default;

beforeEach(() => {
  dados = vazio();
  erro = false;
  cfg = CONFIG_PADRAO;
});

describe("Tvde", () => {
  test("monta e abre na aba Semanas", () => {
    render(<Tvde />);
    expect(screen.getByRole("tab", { name: "Semanas" })).toHaveAttribute("aria-selected", "true");
  });

  test("tem as quatro abas", () => {
    render(<Tvde />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  test("a última aba não promete só metade do que guarda", async () => {
    // Chamava-se "Seg. Social & Despesas" e lá dentro estão quatro coisas —
    // as duas do nome mais a conta destino e a fonte da receita.
    render(<Tvde />);
    const aba = screen.getByRole("tab", { name: "Extras e definições" });
    await userEvent.click(aba);

    expect(screen.getByText("Conta destino da receita")).toBeInTheDocument();
    expect(screen.getByText("Fonte da receita")).toBeInTheDocument();
    expect(screen.getByText(/Segurança Social/)).toBeInTheDocument();
    expect(screen.getByText("Despesas do TVDE")).toBeInTheDocument();
  });

  test("sem semanas registadas: estado vazio que diz qual é a semana atual", () => {
    render(<Tvde />);
    expect(screen.getByText("Nenhuma semana registrada")).toBeInTheDocument();
  });

  test("sincronização caída e sem semanas: avisa em vez de dizer que está vazio", () => {
    erro = true;
    render(<Tvde />);

    expect(screen.queryByText("Nenhuma semana registrada")).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("os valores saem em euros mesmo com a conta noutra moeda", async () => {
    // Regra da seção 4.4: este módulo não segue `cfg.currency`. Se um dia
    // seguisse, os números do TVDE deixavam de bater com os recibos. O
    // CONFIG_PADRAO já é EUR — testar só com ele não provava nada (achado da
    // auditoria de Testes/QA: "testa 'moeda diferente' usando a moeda
    // padrão"). Aqui a conta está em USD e o TVDE tem de ignorar isso.
    cfg = { ...CONFIG_PADRAO, currency: "USD" };
    render(<Tvde />);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("€");
    expect(texto).not.toContain("$");
  });

  test("setas percorrem as abas", async () => {
    render(<Tvde />);
    screen.getByRole("tab", { selected: true }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Meses" })).toHaveAttribute("aria-selected", "true");
  });
});
