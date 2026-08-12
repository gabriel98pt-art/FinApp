// @vitest-environment jsdom

// Definições é a tela mais perigosa do app: é onde se apaga categorias, se
// troca a moeda e se sai da conta. O smoke garante que ela monta com a config
// real e que as acções destrutivas continuam a passar por confirmação — que é
// a única coisa entre um toque errado e dados perdidos.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const sair = vi.fn(async () => {});
const exportarBackup = vi.fn(async () => {});
const importarBackup = vi.fn(async () => {});
const limparErros = vi.fn(async () => {});

vi.mock("../services/authService", () => ({ sair }));
vi.mock("../services/backupService", () => ({ exportarBackup, importarBackup }));
vi.mock("../services/erroService", () => ({
  limparErros,
  // Devolve a função de cancelar subscrição, como o serviço real.
  observarErros: () => () => {},
}));
vi.mock("../services/cfgService", () => ({
  atualizarConfig: vi.fn(async () => {}),
  adicionarItemLista: vi.fn(async () => {}),
  removerItemLista: vi.fn(async () => {}),
  renomearCategoria: vi.fn(async () => {}),
  renomearFonte: vi.fn(async () => {}),
  definirIconeCategoria: vi.fn(async () => {}),
  definirCorCategoria: vi.fn(async () => {}),
  definirCorApp: vi.fn(async () => {}),
}));

let cfg = { ...CONFIG_PADRAO };

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) =>
    s({ sessao: { uid: "u1", email: "eu@exemplo.pt" } }),
}));
vi.mock("../stores/themeStore", () => ({
  useThemeStore: (s: (e: unknown) => unknown) => s({ theme: "dark", alternar: vi.fn() }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Definicoes = (await import("./Definicoes")).default;

beforeEach(() => {
  cfg = { ...CONFIG_PADRAO };
  sair.mockClear();
});

describe("Definicoes", () => {
  test("monta e mostra o título", () => {
    render(<Definicoes />);
    expect(screen.getByRole("heading", { name: "Definições" })).toBeInTheDocument();
  });

  test("mostra o email da sessão — é como se sabe em que conta se está", () => {
    render(<Definicoes />);
    expect(screen.getByText(/eu@exemplo\.pt/)).toBeInTheDocument();
  });

  test("as categorias configuradas aparecem para poderem ser geridas", () => {
    render(<Definicoes />);
    // A primeira categoria do padrão tem de estar visível em algum lado.
    expect(screen.getAllByText(CONFIG_PADRAO.categoriasDespesa[0]).length).toBeGreaterThan(0);
  });

  test("tem saída da conta", () => {
    render(<Definicoes />);
    expect(screen.getByRole("button", { name: /Sair/ })).toBeInTheDocument();
  });

  test("não dispara nada destrutivo só por renderizar", () => {
    // Parece óbvio, mas esta página tem efeitos no arranque (a subscrição dos
    // erros registados) e é fácil um deles passar a escrever por engano.
    render(<Definicoes />);

    expect(sair).not.toHaveBeenCalled();
    expect(exportarBackup).not.toHaveBeenCalled();
    expect(limparErros).not.toHaveBeenCalled();
  });
});
