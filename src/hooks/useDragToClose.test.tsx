// @vitest-environment jsdom

// A folha de baixo (registo rápido, categorias...) abre e fecha por mola, e no
// iPhone fecha-se arrastando com o dedo. O que não pode partir: arrastar mais
// de metade fecha; arrastar pouco volta ao lugar; abrir e fechar pela app
// também corre a mola; com movimento reduzido não há deslize.

import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useDragToClose } from "./useDragToClose";

let fila: FrameRequestCallback[] = [];
let relogio = 0;

/** Corre os frames de animação até a fila esvaziar (a mola assenta). */
function assentar(maxFrames = 600) {
  for (let i = 0; i < maxFrames && fila.length > 0; i++) {
    relogio += 16;
    const atual = fila;
    fila = [];
    act(() => atual.forEach((cb) => cb(relogio)));
  }
}

function Folha({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const { visivel } = useDragToClose({ aberta, folhaRef, veuRef, aoFechar });
  return (
    <div ref={veuRef} data-testid="veu">
      <div ref={folhaRef} data-testid="folha" data-visivel={String(visivel)} />
    </div>
  );
}

const matchMediaOriginal = window.matchMedia;
function movimentoReduzido(ligado: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: ligado && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** O jsdom não faz layout: dá-se à folha a altura que o arrasto precisa. */
function comAltura(folha: HTMLElement, altura: number) {
  Object.defineProperty(folha, "offsetHeight", { configurable: true, value: altura });
}

let agora = 0;
beforeEach(() => {
  fila = [];
  relogio = 0;
  agora = 0;
  movimentoReduzido(false);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fila.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {
    fila = [];
  });
  vi.spyOn(performance, "now").mockImplementation(() => agora);
});

afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const y = (folha: HTMLElement) => folha.style.getPropertyValue("--folha-y");

describe("useDragToClose: abrir e fechar pela app", () => {
  test("fechada não está visível", () => {
    const { getByTestId } = render(<Folha aberta={false} aoFechar={vi.fn()} />);
    expect(getByTestId("folha").dataset.visivel).toBe("false");
  });

  test("ao abrir, a folha sobe por mola desde fora da janela e depois devolve o repouso ao CSS", () => {
    const { getByTestId } = render(<Folha aberta aoFechar={vi.fn()} />);
    const folha = getByTestId("folha");
    expect(folha.dataset.visivel).toBe("true");
    expect(y(folha)).not.toBe("");
    expect(folha.dataset.mola).toBe("true");
    assentar();
    expect(y(folha)).toBe("");
    expect(folha.dataset.mola).toBeUndefined();
    expect(folha.dataset.visivel).toBe("true");
  });

  test("ao fechar, continua visível durante a saída e só depois deixa de estar", () => {
    const { getByTestId, rerender } = render(<Folha aberta aoFechar={vi.fn()} />);
    assentar();
    rerender(<Folha aberta={false} aoFechar={vi.fn()} />);
    expect(getByTestId("folha").dataset.visivel).toBe("true");
    assentar();
    expect(getByTestId("folha").dataset.visivel).toBe("false");
  });

  test("fechar pela app não chama aoFechar (esse é só do arrasto)", () => {
    const aoFechar = vi.fn();
    const { rerender } = render(<Folha aberta aoFechar={aoFechar} />);
    assentar();
    rerender(<Folha aberta={false} aoFechar={aoFechar} />);
    assentar();
    expect(aoFechar).not.toHaveBeenCalled();
  });

  test("com movimento reduzido não há deslize", () => {
    movimentoReduzido(true);
    const { getByTestId } = render(<Folha aberta aoFechar={vi.fn()} />);
    expect(y(getByTestId("folha"))).toBe("");
    expect(fila).toHaveLength(0);
  });
});

describe("useDragToClose: arrastar com o dedo", () => {
  /** O primeiro movimento só «arma» o arrasto (passa a zona morta de 6px e
   *  marca o ponto de partida); a folha só se desloca a partir daí. */
  function abrirEArrastar(dy: number, ms: number) {
    const aoFechar = vi.fn();
    const r = render(<Folha aberta aoFechar={aoFechar} />);
    const folha = r.getByTestId("folha");
    comAltura(folha, 400);
    assentar();
    agora = 0;
    fireEvent.touchStart(folha, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(folha, { touches: [{ clientY: 110 }] });
    agora = ms;
    fireEvent.touchMove(folha, { touches: [{ clientY: 110 + dy }] });
    return { folha, aoFechar };
  }

  test("a folha acompanha o dedo enquanto se arrasta", () => {
    const { folha } = abrirEArrastar(80, 400);
    expect(y(folha)).toBe("80px");
  });

  test("arrastar mais de metade da altura fecha a folha", () => {
    const { folha, aoFechar } = abrirEArrastar(300, 500);
    fireEvent.touchEnd(folha);
    assentar();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  test("arrastar pouco e devagar volta ao lugar sem fechar", () => {
    const { folha, aoFechar } = abrirEArrastar(30, 500);
    fireEvent.touchEnd(folha);
    assentar();
    expect(aoFechar).not.toHaveBeenCalled();
    expect(y(folha)).toBe("");
  });

  test("um gesto para cima é scroll do conteúdo e não arrasta a folha", () => {
    const aoFechar = vi.fn();
    const r = render(<Folha aberta aoFechar={aoFechar} />);
    const folha = r.getByTestId("folha");
    comAltura(folha, 400);
    assentar();
    fireEvent.touchStart(folha, { touches: [{ clientY: 100 }] });
    agora = 300;
    fireEvent.touchMove(folha, { touches: [{ clientY: 50 }] });
    expect(y(folha)).toBe("");
    fireEvent.touchEnd(folha);
    assentar();
    expect(aoFechar).not.toHaveBeenCalled();
  });

  test("com a folha já rolada, o gesto é scroll e não arrasta", () => {
    const aoFechar = vi.fn();
    const r = render(<Folha aberta aoFechar={aoFechar} />);
    const folha = r.getByTestId("folha");
    comAltura(folha, 400);
    assentar();
    folha.scrollTop = 40;
    fireEvent.touchStart(folha, { touches: [{ clientY: 100 }] });
    agora = 300;
    fireEvent.touchMove(folha, { touches: [{ clientY: 300 }] });
    expect(y(folha)).toBe("");
    fireEvent.touchEnd(folha);
    assentar();
    expect(aoFechar).not.toHaveBeenCalled();
  });

  test("dois dedos não iniciam o arrasto", () => {
    const aoFechar = vi.fn();
    const r = render(<Folha aberta aoFechar={aoFechar} />);
    const folha = r.getByTestId("folha");
    assentar();
    fireEvent.touchStart(folha, { touches: [{ clientY: 100 }, { clientY: 140 }] });
    agora = 300;
    fireEvent.touchMove(folha, { touches: [{ clientY: 300 }, { clientY: 340 }] });
    expect(y(folha)).toBe("");
  });

  test("arrastar recolhe o teclado se um campo da folha tinha o foco", () => {
    const aoFechar = vi.fn();
    const r = render(<Folha aberta aoFechar={aoFechar} />);
    const folha = r.getByTestId("folha");
    comAltura(folha, 400);
    const campo = document.createElement("input");
    folha.appendChild(campo);
    campo.focus();
    assentar();
    fireEvent.touchStart(folha, { touches: [{ clientY: 100 }] });
    agora = 400;
    fireEvent.touchMove(folha, { touches: [{ clientY: 160 }] });
    expect(document.activeElement).not.toBe(campo);
  });
});
