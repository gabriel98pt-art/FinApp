import { describe, expect, test } from "vitest";
import { molaAssentou, passoMola, projetarMomentum, rubberBand } from "./spring";

describe("passoMola", () => {
  test("mola crítica (damping=1) converge ao alvo sem ultrapassar", () => {
    let estado = { x: 0, v: 0 };
    let maxX = 0;
    for (let i = 0; i < 500; i++) {
      estado = passoMola(estado, 100, 0.3, 1, 1 / 240);
      maxX = Math.max(maxX, estado.x);
      if (molaAssentou(estado, 100)) break;
    }
    expect(molaAssentou(estado, 100)).toBe(true);
    expect(maxX).toBeLessThanOrEqual(100.5);
  });

  test("mola com bounce leve (damping<1) ultrapassa o alvo antes de assentar", () => {
    let estado = { x: 0, v: 0 };
    let maxX = 0;
    for (let i = 0; i < 500; i++) {
      estado = passoMola(estado, 100, 0.34, 0.8, 1 / 240);
      maxX = Math.max(maxX, estado.x);
      if (molaAssentou(estado, 100)) break;
    }
    expect(molaAssentou(estado, 100)).toBe(true);
    expect(maxX).toBeGreaterThan(100.5);
  });
});

describe("projetarMomentum", () => {
  test("velocidade zero não projeta deslocamento", () => {
    expect(projetarMomentum(0)).toBe(0);
  });

  test("mantém o sinal da velocidade", () => {
    expect(projetarMomentum(500)).toBeGreaterThan(0);
    expect(projetarMomentum(-500)).toBeLessThan(0);
  });

  test("velocidade maior projeta deslocamento maior", () => {
    expect(projetarMomentum(1000)).toBeGreaterThan(projetarMomentum(500));
  });
});

describe("rubberBand", () => {
  test("sem esticar (over=0) não resiste nada", () => {
    expect(rubberBand(0, 400)).toBe(0);
  });

  test("resistência cede menos que o esticado bruto", () => {
    expect(rubberBand(100, 400)).toBeLessThan(100);
  });

  test("é monotonicamente crescente em over", () => {
    expect(rubberBand(200, 400)).toBeGreaterThan(rubberBand(100, 400));
  });
});
