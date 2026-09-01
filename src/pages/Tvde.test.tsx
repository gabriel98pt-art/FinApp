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

// Item 2 do lote de UX/nav (30/08): o corpo da linha + o botão de texto
// solto ao lado ("Lançar receita"/"Desfazer lançamento") viram um menu
// único, junto de Editar/Excluir.
describe("menu de ações da semana (item 2)", () => {
  test("semana sem lançamento: o menu oferece Editar, Lançar receita e Excluir", async () => {
    dados = {
      ...vazio(),
      semanas: { "30": { fat: 100000, teste: false } },
    } as unknown as DadosTvde;
    render(<Tvde />);

    await userEvent.click(screen.getByRole("button", { name: /Semana 30/ }));

    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lançar receita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer lançamento" })).not.toBeInTheDocument();
  });

  test("semana já lançada: o menu troca para Desfazer lançamento", async () => {
    dados = {
      ...vazio(),
      semanas: { "30": { fat: 100000, teste: false } },
      lancamentos: { "30": "desp1" },
    } as unknown as DadosTvde;
    render(<Tvde />);

    await userEvent.click(screen.getByRole("button", { name: /Semana 30/ }));

    expect(await screen.findByRole("button", { name: "Desfazer lançamento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lançar receita" })).not.toBeInTheDocument();
  });
});

// 01/09: a lista de semanas é a única do app que não está presa a um mês —
// guarda TODAS as semanas já registadas, uma por semana do ano. Ao fim do
// primeiro ano são 52 cartões grandes seguidos e a semana passada, a que mais
// se abre, fica atrás de uma rolagem cada vez maior.
describe("paginação das semanas (01/09)", () => {
  /** `n` semanas registadas, numeradas de 1 a n. */
  const comSemanas = (n: number) =>
    ({
      ...vazio(),
      semanas: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [String(i + 1), { fat: 100000, teste: false }]),
      ),
    }) as unknown as DadosTvde;

  /** Os cartões de semana à vista agora — o rótulo é "Semana N · <datas>". */
  const semanasNaTela = () => screen.getAllByRole("button", { name: /^Semana \d+ ·/ });

  test("com 15 semanas ou menos, nada de paginador", () => {
    dados = comSemanas(15);
    render(<Tvde />);

    expect(semanasNaTela()).toHaveLength(15);
    expect(screen.queryByRole("button", { name: "Página seguinte" })).toBeNull();
  });

  test("com mais de 15, mostra 15 e as mais recentes vêm primeiro", () => {
    dados = comSemanas(20);
    render(<Tvde />);

    expect(semanasNaTela()).toHaveLength(15);
    // A lista é do mais recente para o mais antigo: a 20 abre a página 1 e a
    // 5 já caiu para a seguinte.
    expect(screen.getByRole("button", { name: /^Semana 20 ·/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Semana 5 ·/ })).toBeNull();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  test("a página seguinte mostra as semanas mais antigas", async () => {
    dados = comSemanas(20);
    render(<Tvde />);

    await userEvent.click(screen.getByRole("button", { name: "Página seguinte" }));

    expect(semanasNaTela()).toHaveLength(5);
    expect(screen.getByRole("button", { name: /^Semana 5 ·/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Semana 20 ·/ })).toBeNull();
  });
});
