// @vitest-environment jsdom

// A escrita adiada existe pra não bloquear a thread principal a cada mudança
// de estado (achado da auditoria de Performance & PWA). O que se protege
// aqui: a escrita realmente não acontece na hora, várias mudanças na mesma
// janela viram UMA escrita por chave (não uma por mudança), uma leitura logo
// a seguir a uma escrita ainda pendente vê o valor novo, e nada se perde se a
// aba fechar antes do idle disparar.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Este projeto testa jsdom sem `localStorage` de verdade (nem
// `window.localStorage` existe) — daí o polyfill em memória, em vez de
// confiar no do ambiente.
function localStorageEmMemoria(): Storage {
  const dados = new Map<string, string>();
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => {
      dados.set(chave, valor);
    },
    removeItem: (chave) => {
      dados.delete(chave);
    },
    clear: () => dados.clear(),
    key: () => null,
    get length() {
      return dados.size;
    },
  };
}

let mockLocalStorage: Storage;

beforeEach(() => {
  mockLocalStorage = localStorageEmMemoria();
  vi.stubGlobal("localStorage", mockLocalStorage);
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

describe("persistenciaAdiada", () => {
  test("setItem não escreve na hora — só depois do timer (fallback sem requestIdleCallback)", async () => {
    const { persistenciaAdiada } = await import("./persistenciaAdiada");
    persistenciaAdiada!.setItem("chave", { state: { a: 1 }, version: 0 });

    expect(localStorage.getItem("chave")).toBeNull();

    await vi.runAllTimersAsync();
    expect(JSON.parse(localStorage.getItem("chave")!)).toEqual({ state: { a: 1 }, version: 0 });
  });

  test("duas escritas na mesma janela viram uma só, com o valor mais recente", async () => {
    const espiao = vi.spyOn(mockLocalStorage, "setItem");
    const { persistenciaAdiada } = await import("./persistenciaAdiada");
    persistenciaAdiada!.setItem("chave", { state: { a: 1 }, version: 0 });
    persistenciaAdiada!.setItem("chave", { state: { a: 2 }, version: 0 });

    await vi.runAllTimersAsync();

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("chave")!)).toEqual({ state: { a: 2 }, version: 0 });
  });

  test("ler logo a seguir a escrever (antes do timer) já vê o valor novo", async () => {
    const { persistenciaAdiada } = await import("./persistenciaAdiada");
    persistenciaAdiada!.setItem("chave", { state: { a: 9 }, version: 0 });

    const lido = await persistenciaAdiada!.getItem("chave");
    expect(lido).toEqual({ state: { a: 9 }, version: 0 });
  });

  test("visibilitychange para 'hidden' escreve na hora, sem esperar o timer", async () => {
    const { persistenciaAdiada } = await import("./persistenciaAdiada");
    persistenciaAdiada!.setItem("chave", { state: { a: 5 }, version: 0 });
    expect(localStorage.getItem("chave")).toBeNull();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(JSON.parse(localStorage.getItem("chave")!)).toEqual({ state: { a: 5 }, version: 0 });
  });

  test("removeItem some da fila e do localStorage imediatamente", async () => {
    const { persistenciaAdiada } = await import("./persistenciaAdiada");
    persistenciaAdiada!.setItem("chave", { state: { a: 1 }, version: 0 });
    persistenciaAdiada!.removeItem("chave");

    await vi.runAllTimersAsync();
    expect(localStorage.getItem("chave")).toBeNull();
  });
});
