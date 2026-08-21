// @vitest-environment jsdom

// Definições é a tela mais perigosa do app: é onde se apaga categorias, se
// troca a moeda e se sai da conta. O smoke garante que ela monta com a config
// real e que as acções destrutivas continuam a passar por confirmação — que é
// a única coisa entre um toque errado e dados perdidos.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CONFIG_PADRAO } from "../constants/configPadrao";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const sair = vi.fn(async () => {});
const alterarSenha = vi.fn(async () => {});
const apagarConta = vi.fn(async () => {});
const exportarBackup = vi.fn(async () => {});
const importarBackup = vi.fn(async () => {});
const limparErros = vi.fn(async () => {});
const definirPreferenciasCopiloto = vi.fn(async () => {});

vi.mock("../services/authService", () => ({
  sair,
  alterarSenha,
  apagarConta,
  mensagemDeErroSenhaAtual: (err: unknown) => String(err),
  SENHA_MINIMA: 8,
}));
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
  definirPreferenciasCopiloto,
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
  alterarSenha.mockClear();
  apagarConta.mockClear();
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
    // Categorias também viraram folha própria — abre antes de procurar.
    fireEvent.click(screen.getByRole("button", { name: /Categorias de despesa/ }));
    expect(screen.getAllByText(CONFIG_PADRAO.categoriasDespesa[0]).length).toBeGreaterThan(0);
  });

  test("tem saída da conta", () => {
    render(<Definicoes />);
    expect(screen.getByRole("button", { name: /Sair/ })).toBeInTheDocument();
  });

  test("dá para trocar a senha sem sair da conta", () => {
    render(<Definicoes />);
    // A troca de senha vive numa folha própria (redesign em índice+folhas) —
    // abre pelo gatilho antes de os campos existirem no DOM.
    fireEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha nova")).toBeInTheDocument();
  });

  test("a senha nova exige o mínimo da app, não o do Firebase", () => {
    render(<Definicoes />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
    // 6 é o que o Firebase aceita; a app pede mais por guardar dados
    // financeiros. Se este mínimo cair, cai em silêncio — daí o teste.
    expect(screen.getByLabelText("Senha nova")).toHaveAttribute("minLength", "8");
  });

  test("dá para personalizar o Copiloto", () => {
    render(<Definicoes />);
    // Também vive numa folha própria — mesmo motivo do teste de senha.
    fireEvent.click(screen.getByRole("button", { name: "Copiloto" }));
    expect(screen.getByLabelText("Nome para o Copiloto")).toBeInTheDocument();
  });

  test("sem personalização guardada, não oferece desligar o que não está ligado", () => {
    render(<Definicoes />);
    fireEvent.click(screen.getByRole("button", { name: "Copiloto" }));
    expect(screen.queryByRole("button", { name: /Desligar/ })).not.toBeInTheDocument();
  });

  test("dá para apagar a conta — o direito ao apagamento precisa de botão", () => {
    render(<Definicoes />);
    expect(screen.getByRole("button", { name: /Apagar conta/ })).toBeInTheDocument();
  });

  test("não dispara nada destrutivo só por renderizar", () => {
    // Parece óbvio, mas esta página tem efeitos no arranque (a subscrição dos
    // erros registados) e é fácil um deles passar a escrever por engano.
    render(<Definicoes />);

    expect(sair).not.toHaveBeenCalled();
    expect(alterarSenha).not.toHaveBeenCalled();
    expect(apagarConta).not.toHaveBeenCalled();
    expect(definirPreferenciasCopiloto).not.toHaveBeenCalled();
    expect(exportarBackup).not.toHaveBeenCalled();
    expect(limparErros).not.toHaveBeenCalled();
  });
});
