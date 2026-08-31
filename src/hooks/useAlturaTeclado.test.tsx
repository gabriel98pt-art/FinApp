// @vitest-environment jsdom

// O botão "Salvar" do Registro Rápido ficava debaixo do teclado do telemóvel:
// no iOS o teclado não encolhe a página, então a folha continuava com a altura
// do ecrã inteiro e o fundo dela (onde estão as ações) caía atrás do teclado.
// Estes testes prendem a medida que o CSS usa para encurtar a folha.

import { afterEach, describe, expect, test } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAlturaTeclado } from "./useAlturaTeclado";

type JanelaVisual = {
  height: number;
  offsetTop: number;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};

const ouvintes = new Set<() => void>();

function instalarJanelaVisual(altura: number, offsetTop = 0) {
  const vv: JanelaVisual = {
    height: altura,
    offsetTop,
    addEventListener: (_t, f) => ouvintes.add(f),
    removeEventListener: (_t, f) => ouvintes.delete(f),
  };
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  return vv;
}

function Sonda() {
  useAlturaTeclado();
  return null;
}

const lerToken = () => document.documentElement.style.getPropertyValue("--altura-teclado");

afterEach(() => {
  cleanup();
  ouvintes.clear();
  Reflect.deleteProperty(window, "visualViewport");
  document.documentElement.style.removeProperty("--altura-teclado");
});

describe("useAlturaTeclado", () => {
  test("sem teclado não escreve altura nenhuma", () => {
    instalarJanelaVisual(window.innerHeight);
    render(<Sonda />);
    expect(lerToken()).toBe("0px");
  });

  test("com o teclado aberto publica a altura que ele tapa", () => {
    instalarJanelaVisual(window.innerHeight - 300);
    render(<Sonda />);
    expect(lerToken()).toBe("300px");
  });

  test("desconta o deslocamento da janela visual", () => {
    // Quando o iOS desloca a janela visual para baixo (offsetTop), o fundo
    // dela sobe menos, e o teclado tapa menos do ecrã do que a diferença de
    // alturas sugere. A folha é `position: fixed`, medida contra o ecrã
    // inteiro — sem descontar isto, subia mais do que devia.
    instalarJanelaVisual(window.innerHeight - 300, 40);
    render(<Sonda />);
    expect(lerToken()).toBe("260px");
  });

  test("ignora encolhimentos pequenos, como a barra de endereço do Safari", () => {
    instalarJanelaVisual(window.innerHeight - 50);
    render(<Sonda />);
    expect(lerToken()).toBe("0px");
  });

  test("acompanha o teclado a fechar", () => {
    const vv = instalarJanelaVisual(window.innerHeight - 300);
    render(<Sonda />);
    expect(lerToken()).toBe("300px");

    vv.height = window.innerHeight;
    for (const f of ouvintes) f();
    expect(lerToken()).toBe("0px");
  });

  test("num browser sem visualViewport não mexe em nada", () => {
    render(<Sonda />);
    expect(lerToken()).toBe("");
  });
});
