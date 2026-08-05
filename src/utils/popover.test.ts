import { describe, expect, test } from "vitest";
import { ALTURA_MINIMA, ESPACO, MARGEM, posicionarPopover, type Retangulo } from "./popover";

/** Janela de desktop comum. */
const JANELA = { largura: 1440, altura: 900 };
/** Caixa de tamanho típico: um seletor com meia dúzia de opções. */
const CAIXA = { largura: 240, altura: 260 };

const gatilho = (extra: Partial<Retangulo> = {}): Retangulo => ({
  top: 100,
  left: 500,
  bottom: 130,
  width: 160,
  ...extra,
});

describe("para que lado abre", () => {
  test("por baixo, quando cabe — o caso normal", () => {
    const p = posicionarPopover(gatilho(), CAIXA, JANELA);
    expect(p.acima).toBe(false);
    expect(p.top).toBe(130 + ESPACO);
  });

  test("por cima, quando não cabe em baixo e sobra mais espaço em cima", () => {
    // Gatilho quase no fim da janela: 60px por baixo, 800 por cima.
    const p = posicionarPopover(gatilho({ top: 820, bottom: 850 }), CAIXA, JANELA);
    expect(p.acima).toBe(true);
    // Fica assente sobre o gatilho, com o espaço de respiro.
    expect(p.top).toBe(820 - ESPACO - CAIXA.altura);
  });

  test("continua por baixo se não cabe em lado nenhum mas em baixo sobra mais", () => {
    // Gatilho no topo: 40px por cima, muito mais por baixo.
    const p = posicionarPopover(
      gatilho({ top: 60, bottom: 90 }),
      { ...CAIXA, altura: 2000 },
      JANELA,
    );
    expect(p.acima).toBe(false);
  });

  test("caixa que cabe exatamente por baixo não vira", () => {
    // espacoAbaixo = 900 - 130 - 6 - 8 = 756. Uma caixa de 756 cabe.
    const p = posicionarPopover(gatilho(), { ...CAIXA, altura: 756 }, JANELA);
    expect(p.acima).toBe(false);
    // Um pixel a mais já não cabe, e em cima há menos espaço — fica em baixo.
    expect(posicionarPopover(gatilho(), { ...CAIXA, altura: 757 }, JANELA).acima).toBe(false);
  });
});

describe("altura máxima", () => {
  test("é o espaço que sobra do lado escolhido", () => {
    const p = posicionarPopover(gatilho(), CAIXA, JANELA);
    expect(p.maxAltura).toBe(900 - 130 - ESPACO - MARGEM);
  });

  test("nunca desce abaixo do mínimo quando os dois lados estão apertados", () => {
    // Janela baixa (barra de endereço + teclado, ou janela encolhida) com o
    // gatilho a meio: 66px por baixo, 76 por cima. Nenhum dos dois dá 120.
    const baixa = { largura: 1440, altura: 200 };
    const p = posicionarPopover(gatilho({ top: 90, bottom: 120 }), CAIXA, baixa);
    expect(p.maxAltura).toBe(ALTURA_MINIMA);
  });

  test("a caixa alta que abre para cima fica presa na margem, não sai da janela", () => {
    // Gatilho em baixo, onde abrir para cima é a escolha certa.
    const p = posicionarPopover(
      gatilho({ top: 700, bottom: 730 }),
      { ...CAIXA, altura: 5000 },
      JANELA,
    );
    expect(p.acima).toBe(true);
    expect(p.top).toBe(MARGEM);
  });

  test("gatilho colado ao fundo da janela vira para cima e aproveita o espaço todo", () => {
    const p = posicionarPopover(gatilho({ top: 880, bottom: 898 }), CAIXA, JANELA);
    expect(p.acima).toBe(true);
    expect(p.maxAltura).toBe(880 - ESPACO - MARGEM);
  });
});

describe("horizontal — nunca sai pelas bordas", () => {
  test("alinha pela esquerda do gatilho quando há espaço", () => {
    const p = posicionarPopover(gatilho({ left: 500 }), CAIXA, JANELA);
    expect(p.left).toBe(500);
  });

  test("puxa para dentro quando transbordaria à direita", () => {
    const p = posicionarPopover(gatilho({ left: 1380 }), CAIXA, JANELA);
    expect(p.left).toBe(1440 - CAIXA.largura - MARGEM);
    expect(p.left + CAIXA.largura).toBeLessThanOrEqual(1440 - MARGEM);
  });

  test("gatilho encostado à esquerda não empurra a caixa para fora", () => {
    const p = posicionarPopover(gatilho({ left: 0 }), CAIXA, JANELA);
    expect(p.left).toBe(MARGEM);
  });

  test("caixa mais larga do que a janela começa na margem, não em negativo", () => {
    const p = posicionarPopover(gatilho(), { ...CAIXA, largura: 2000 }, JANELA);
    expect(p.left).toBe(MARGEM);
  });
});

describe("janela estreita (desktop pequeno / janela reduzida)", () => {
  test("a caixa continua dentro da janela", () => {
    const estreita = { largura: 800, altura: 500 };
    const p = posicionarPopover(gatilho({ left: 700, top: 420, bottom: 450 }), CAIXA, estreita);
    expect(p.left).toBeGreaterThanOrEqual(MARGEM);
    expect(p.left + CAIXA.largura).toBeLessThanOrEqual(estreita.largura - MARGEM);
    expect(p.top).toBeGreaterThanOrEqual(MARGEM);
  });
});
