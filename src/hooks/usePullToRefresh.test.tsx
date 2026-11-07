// @vitest-environment jsdom

// Puxar do topo para atualizar, no iPhone. O que mais importa: só puxar quando
// a página está no topo, nunca roubar o gesto a uma folha aberta, e só
// recarregar quando o puxão passou do limite E não há versão nova a caminho
// (nesse caso quem trata é o usePwaUpdate).

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePullToRefresh } from "./usePullToRefresh";

const checarVersaoNova = vi.fn<() => Promise<boolean>>();
vi.mock("../stores/pwaStore", () => ({ checarVersaoNova: () => checarVersaoNova() }));

const matchMediaOriginal = window.matchMedia;

/** Sem mola: com `prefers-reduced-motion` o hook volta ao topo de imediato,
 *  o que torna o teste determinístico (a mola em si está em `spring.test.ts`). */
function semMovimento() {
  window.matchMedia = ((q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const toque = (clientY: number) =>
  ({ pointerType: "touch", clientY }) as unknown as React.PointerEvent;
const rato = (clientY: number) =>
  ({ pointerType: "mouse", clientY }) as unknown as React.PointerEvent;

const reload = vi.fn();
const locationOriginal = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  semMovimento();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...locationOriginal, reload },
  });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  Object.defineProperty(window, "location", { configurable: true, value: locationOriginal });
  document.body.innerHTML = "";
});

function puxar(
  r: ReturnType<typeof renderHook<ReturnType<typeof usePullToRefresh>, unknown>>,
  ate: number,
) {
  const m = r.result.current.manipuladores;
  act(() => m.onPointerDown(toque(0)));
  act(() => r.result.current.manipuladores.onPointerMove(toque(ate)));
}

describe("usePullToRefresh", () => {
  test("começa escondido", () => {
    const { result } = renderHook(() => usePullToRefresh());
    expect(result.current.visivel).toBe(false);
    expect(result.current.armado).toBe(false);
    expect(result.current.recarregando).toBe(false);
  });

  test("o rato não puxa (só o dedo)", () => {
    const r = renderHook(() => usePullToRefresh());
    act(() => r.result.current.manipuladores.onPointerDown(rato(0)));
    act(() => r.result.current.manipuladores.onPointerMove(rato(50)));
    expect(r.result.current.visivel).toBe(false);
  });

  test("com a página já rolada, o gesto é scroll e não puxa", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 50);
    expect(r.result.current.visivel).toBe(false);
  });

  test("com uma folha aberta, o gesto é dela", () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 50);
    expect(r.result.current.visivel).toBe(false);
  });

  test("uma folha fechada (inert) não bloqueia o puxão", () => {
    document.body.innerHTML = '<div role="dialog" inert></div>';
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 50);
    expect(r.result.current.visivel).toBe(true);
  });

  test("puxar pouco mostra o indicador mas não arma", () => {
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 40);
    expect(r.result.current.visivel).toBe(true);
    expect(r.result.current.armado).toBe(false);
  });

  test("passar do limite arma o gesto", () => {
    const r = renderHook(() => usePullToRefresh());
    puxar(r, r.result.current.limite + 20);
    expect(r.result.current.armado).toBe(true);
  });

  test("soltar antes do limite volta ao topo sem recarregar", async () => {
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 40);
    await act(async () => r.result.current.manipuladores.onPointerUp());
    expect(checarVersaoNova).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(r.result.current.visivel).toBe(false);
    expect(r.result.current.recarregando).toBe(false);
  });

  test("soltar depois do limite, sem versão nova, recarrega a página", async () => {
    checarVersaoNova.mockResolvedValue(false);
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 100);
    await act(async () => r.result.current.manipuladores.onPointerUp());
    expect(r.result.current.recarregando).toBe(true);
    expect(checarVersaoNova).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test("soltar depois do limite, com versão nova, não recarrega (é o usePwaUpdate que trata)", async () => {
    checarVersaoNova.mockResolvedValue(true);
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 100);
    await act(async () => r.result.current.manipuladores.onPointerUp());
    expect(checarVersaoNova).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  test("cancelar o gesto (o sistema tomou o controlo) nunca recarrega", async () => {
    const r = renderHook(() => usePullToRefresh());
    puxar(r, 120);
    await act(async () => r.result.current.manipuladores.onPointerCancel());
    expect(checarVersaoNova).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(r.result.current.visivel).toBe(false);
  });

  test("puxar para cima larga o gesto (é scroll normal)", () => {
    const r = renderHook(() => usePullToRefresh());
    const m = r.result.current.manipuladores;
    act(() => m.onPointerDown(toque(100)));
    act(() => r.result.current.manipuladores.onPointerMove(toque(60)));
    act(() => r.result.current.manipuladores.onPointerMove(toque(150)));
    expect(r.result.current.visivel).toBe(false);
  });
});
