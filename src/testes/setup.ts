// Preparação dos testes de componente.
//
// O `setupFiles` do Vitest corre para TODOS os ficheiros de teste, e a maior
// parte deles é lógica pura em ambiente `node`, onde não há `window`. Importar
// o jest-dom ali em cima rebentava os 42 ficheiros de lógica de uma vez. Daí a
// guarda: fora do jsdom este ficheiro não faz rigorosamente nada.

import { afterEach, vi } from "vitest";

if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  afterEach(() => {
    // Sem isto, cada teste acumula o DOM do anterior e um `getByText` passa a
    // encontrar dois elementos iguais — falha confusa, e que não é culpa do
    // teste que a mostra.
    cleanup();
  });

  // Várias telas leem media queries (`useMediaQuery` escolhe entre folha e
  // popover; a grelha de KPIs entre 2 e 4 cartões). O jsdom não traz
  // `matchMedia`, e sem ele o render rebenta antes de chegar ao que se quer
  // testar. O padrão é o desktop — quem quiser o telemóvel sobrescreve.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  if (!("ResizeObserver" in window)) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}
