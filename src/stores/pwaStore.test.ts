import { beforeEach, describe, expect, test, vi } from "vitest";
import { checarVersaoNova, usePwaStore } from "./pwaStore";

/** Registro falso: só precisa do `update()`, que é o que força a checagem. */
function registroFalso(update: () => Promise<void>) {
  return { update } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  usePwaStore.setState({ registro: null, aplicando: false });
});

describe("checarVersaoNova", () => {
  test("pede a checagem ao service worker, não confia no reload", async () => {
    const update = vi.fn(() => Promise.resolve());
    usePwaStore.setState({ registro: registroFalso(update) });

    await checarVersaoNova(10);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("já na última versão: ninguém assume, quem chamou recarrega", async () => {
    usePwaStore.setState({ registro: registroFalso(() => Promise.resolve()) });

    expect(await checarVersaoNova(10)).toBe(false);
  });

  test("versão nova encontrada: o usePwaUpdate assume", async () => {
    usePwaStore.setState({ registro: registroFalso(() => Promise.resolve()) });

    const resultado = checarVersaoNova(200);
    // É o que o usePwaUpdate faz ao ver o needRefresh chegar.
    setTimeout(() => usePwaStore.getState().marcarAplicando(), 10);

    expect(await resultado).toBe(true);
  });

  test("versão nova já a ser aplicada: nem chega a checar de novo", async () => {
    const update = vi.fn(() => Promise.resolve());
    usePwaStore.setState({ registro: registroFalso(update), aplicando: true });

    expect(await checarVersaoNova(10)).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  test("checagem falhou (sem rede): recarrega na mesma", async () => {
    usePwaStore.setState({ registro: registroFalso(() => Promise.reject(new Error("offline"))) });

    expect(await checarVersaoNova(10)).toBe(false);
  });

  test("sem service worker registado: recarrega na mesma", async () => {
    expect(await checarVersaoNova(10)).toBe(false);
  });
});
