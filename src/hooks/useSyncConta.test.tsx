// @vitest-environment jsdom

// Liga a sincronização à conta logada. Se este hook falhar, a app abre com as
// stores vazias (sem receitas nem despesas) ou deixa subscrições do Firebase
// penduradas depois de sair da conta.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSyncConta } from "./useSyncConta";

const parar = vi.fn();
const iniciarSyncConta = vi.fn<(uid: string) => () => void>(() => parar);
const estado: { sessao: { uid: string } | null } = { sessao: null };

vi.mock("../services/syncService", () => ({
  iniciarSyncConta: (uid: string) => iniciarSyncConta(uid),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (seletor: (e: typeof estado) => unknown) => seletor(estado),
}));

beforeEach(() => {
  vi.clearAllMocks();
  estado.sessao = null;
});

describe("useSyncConta", () => {
  test("sem sessão, não sincroniza nada", () => {
    renderHook(() => useSyncConta());
    expect(iniciarSyncConta).not.toHaveBeenCalled();
  });

  test("com sessão, começa a sincronizar a conta certa", () => {
    estado.sessao = { uid: "conta-a" };
    renderHook(() => useSyncConta());
    expect(iniciarSyncConta).toHaveBeenCalledTimes(1);
    expect(iniciarSyncConta).toHaveBeenCalledWith("conta-a");
  });

  test("ao sair do ecrã, pára a sincronização", () => {
    estado.sessao = { uid: "conta-a" };
    const { unmount } = renderHook(() => useSyncConta());
    expect(parar).not.toHaveBeenCalled();
    unmount();
    expect(parar).toHaveBeenCalledTimes(1);
  });

  test("ao mudar de conta, pára a anterior e começa a nova", () => {
    estado.sessao = { uid: "conta-a" };
    const { rerender } = renderHook(() => useSyncConta());
    estado.sessao = { uid: "conta-b" };
    rerender();
    expect(parar).toHaveBeenCalledTimes(1);
    expect(iniciarSyncConta).toHaveBeenLastCalledWith("conta-b");
  });

  test("ao terminar a sessão, pára e não começa outra", () => {
    estado.sessao = { uid: "conta-a" };
    const { rerender } = renderHook(() => useSyncConta());
    estado.sessao = null;
    rerender();
    expect(parar).toHaveBeenCalledTimes(1);
    expect(iniciarSyncConta).toHaveBeenCalledTimes(1);
  });
});
