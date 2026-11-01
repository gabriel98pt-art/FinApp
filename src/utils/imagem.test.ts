import { describe, expect, test } from "vitest";
import {
  bytesDoDataUrl,
  comprimirAteCaber,
  erroDoFicheiro,
  FOTO_MAX_BYTES,
  ORIGEM_MAX_BYTES,
  recorteQuadrado,
} from "./imagem";

describe("erroDoFicheiro", () => {
  test("aceita JPEG, PNG e WebP de tamanho normal", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(erroDoFicheiro({ type, size: 500_000 })).toBeNull();
    }
  });
  test("recusa outros tipos", () => {
    expect(erroDoFicheiro({ type: "image/svg+xml", size: 100 })).toMatch(/JPEG, PNG ou WebP/);
    expect(erroDoFicheiro({ type: "application/pdf", size: 100 })).not.toBeNull();
    expect(erroDoFicheiro({ type: "", size: 100 })).not.toBeNull();
  });
  test("recusa vazio e grande demais", () => {
    expect(erroDoFicheiro({ type: "image/png", size: 0 })).not.toBeNull();
    expect(erroDoFicheiro({ type: "image/png", size: ORIGEM_MAX_BYTES + 1 })).toMatch(/grande/);
  });
});

describe("recorteQuadrado", () => {
  test("corta o centro, sem deformar", () => {
    expect(recorteQuadrado(400, 200)).toEqual({ sx: 100, sy: 0, lado: 200 });
    expect(recorteQuadrado(200, 600)).toEqual({ sx: 0, sy: 200, lado: 200 });
    expect(recorteQuadrado(300, 300)).toEqual({ sx: 0, sy: 0, lado: 300 });
  });
});

describe("bytesDoDataUrl", () => {
  test("conta os bytes da imagem, não do texto", () => {
    expect(bytesDoDataUrl("data:image/webp;base64,AAAA")).toBe(3);
    expect(bytesDoDataUrl("data:image/webp;base64,AAA=")).toBe(2);
    expect(bytesDoDataUrl("data:image/webp;base64,AA==")).toBe(1);
  });
});

describe("comprimirAteCaber", () => {
  const url = (bytes: number) => "data:image/webp;base64," + "A".repeat(Math.ceil((bytes * 4) / 3));

  test("devolve a primeira qualidade que cabe", async () => {
    const tentadas: number[] = [];
    const r = await comprimirAteCaber(
      async (q) => {
        tentadas.push(q);
        return url(q > 0.6 ? 50_000 : 10_000);
      },
      [0.9, 0.7, 0.5, 0.3],
      FOTO_MAX_BYTES,
    );
    expect(tentadas).toEqual([0.9, 0.7, 0.5]);
    expect(bytesDoDataUrl(r!)).toBeLessThanOrEqual(FOTO_MAX_BYTES);
  });

  test("nem a mais baixa cabe: null", async () => {
    const r = await comprimirAteCaber(async () => url(100_000), [0.9, 0.5], FOTO_MAX_BYTES);
    expect(r).toBeNull();
  });
});
