// @vitest-environment jsdom

// «Minha conta» herdou a secção «Conta» de Definições (senha, sair, apagar) e
// trouxe a foto e o nome. Os testes que protegiam a secção antiga vivem aqui.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CONFIG_PADRAO } from "../../constants/configPadrao";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));

const sair = vi.fn(async () => {});
const apagarConta = vi.fn(async () => {});
const atualizarConfig = vi.fn(async () => {});

vi.mock("../../services/authService", () => ({
  sair,
  alterarSenha: vi.fn(async () => {}),
  apagarConta,
  mensagemDeErroSenhaAtual: (err: unknown) => String(err),
  SENHA_MINIMA: 8,
}));
vi.mock("../../services/cfgService", () => ({ atualizarConfig }));

let cfg = { ...CONFIG_PADRAO };
vi.mock("../../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) =>
    s({ sessao: { uid: "u1", email: "eu@exemplo.pt" } }),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const FolhaConta = (await import("./FolhaConta")).default;

beforeEach(() => {
  cfg = { ...CONFIG_PADRAO };
  sair.mockClear();
  apagarConta.mockClear();
  atualizarConfig.mockClear();
});

describe("FolhaConta", () => {
  test("mostra o email da sessão — é como se sabe em que conta se está", () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    expect(screen.getByText("eu@exemplo.pt")).toBeInTheDocument();
  });

  test("tem saída da conta", () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Sair da conta/ }));
    expect(sair).toHaveBeenCalledTimes(1);
  });

  test("dá para trocar a senha sem sair da conta, com o mínimo da app", () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Trocar senha/ }));
    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    // 6 é o que o Firebase aceita; a app pede mais por guardar dados financeiros.
    expect(screen.getByLabelText("Senha nova")).toHaveAttribute("minLength", "8");
  });

  test("dá para apagar a conta — o direito ao apagamento precisa de botão", () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    expect(screen.getByRole("button", { name: /Apagar conta/ })).toBeInTheDocument();
  });

  test("não dispara nada só por abrir", () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    expect(sair).not.toHaveBeenCalled();
    expect(apagarConta).not.toHaveBeenCalled();
    expect(atualizarConfig).not.toHaveBeenCalled();
  });

  test("o nome é opcional e guarda-se limpo", async () => {
    render(<FolhaConta aberta aoFechar={() => {}} />);
    const campo = screen.getByLabelText(/Nome \(opcional\)/);
    const guardar = screen.getByRole("button", { name: "Guardar" });
    expect(guardar).toBeDisabled(); // nada mudou
    fireEvent.change(campo, { target: { value: "  Ana   Silva " } });
    fireEvent.click(guardar);
    await waitFor(() => expect(atualizarConfig).toHaveBeenCalledWith("u1", { nome: "Ana Silva" }));
  });

  test("sem foto oferece escolher; com foto oferece trocar e remover", () => {
    const { unmount } = render(<FolhaConta aberta aoFechar={() => {}} />);
    expect(screen.getByRole("button", { name: /Escolher foto/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover foto/ })).toBeNull();
    unmount();

    cfg = { ...CONFIG_PADRAO, foto: "data:image/webp;base64,AAAA" };
    render(<FolhaConta aberta aoFechar={() => {}} />);
    expect(screen.getByRole("button", { name: /Trocar foto/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remover foto/ }));
    return waitFor(() => expect(atualizarConfig).toHaveBeenCalledWith("u1", { foto: "" }));
  });
});
