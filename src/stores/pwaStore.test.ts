import { beforeEach, describe, expect, test, vi } from "vitest";
import { checarVersaoNova, recarregarQuandoLivre, usePwaStore } from "./pwaStore";
import { useUiStore } from "./uiStore";

/** Registro falso: só precisa do `update()`, que é o que força a checagem. */
function registroFalso(update: () => Promise<void>) {
  return { update } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  usePwaStore.setState({ registro: null, aplicando: false });
  useUiStore.setState({ registroAberto: false });
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

describe("recarregarQuandoLivre", () => {
  // O caso relatado: abrir o atalho do iPhone, a atualização chegar sozinha
  // uns segundos depois, e o Registro Rápido já ter algo digitado que se
  // perdia no reload sem aviso nenhum.
  test("sem o Registro Rápido aberto, recarrega na hora", () => {
    const recarregar = vi.fn();
    recarregarQuandoLivre(recarregar, 10_000);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  test("com o Registro Rápido aberto, espera fechar antes de recarregar", async () => {
    useUiStore.setState({ registroAberto: true });
    const recarregar = vi.fn();

    recarregarQuandoLivre(recarregar, 10_000);
    expect(recarregar).not.toHaveBeenCalled();

    useUiStore.setState({ registroAberto: false });
    // O subscribe é síncrono, mas dá um instante ao microtask/macrotask.
    await new Promise((r) => setTimeout(r, 0));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  test("reabrir depois de já ter fechado não recarrega uma segunda vez", async () => {
    useUiStore.setState({ registroAberto: true });
    const recarregar = vi.fn();

    recarregarQuandoLivre(recarregar, 10_000);
    useUiStore.setState({ registroAberto: false }); // dispara o reload e desliga a escuta
    useUiStore.setState({ registroAberto: true }); // não deve religar nada
    await new Promise((r) => setTimeout(r, 0));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  test("folha esquecida aberta: recarrega de qualquer jeito no limite máximo", async () => {
    useUiStore.setState({ registroAberto: true });
    const recarregar = vi.fn();

    recarregarQuandoLivre(recarregar, 20);
    expect(recarregar).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 40));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
