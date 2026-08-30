// Item 6 do lote de UX/nav (30/08, correção do Gestor): o bug real era o
// verde ter sumido de vez do seletor de cor — nem a categoria fixa "Receita"
// nem NENHUMA fonte de receita conseguiam usá-lo, porque `CORES_CATEGORIA`
// (a única grade que o seletor oferecia) não tem verde desde que o pedido
// "verde só na Receita" (26/08) o removeu de vez da paleta geral. A regra
// continua valendo pra despesa/veículo — só as fontes de receita ganharam a
// grade própria com o verde de volta, ver `CORES_FONTE_RECEITA`.

import { describe, expect, test } from "vitest";
import { CORES_CATEGORIA, CORES_FONTE_RECEITA } from "./aparenciaCategoria";
import { VERDE_RECEITA } from "../utils/coresCategoria";

describe("CORES_FONTE_RECEITA", () => {
  test("inclui o verde de Receita", () => {
    expect(CORES_FONTE_RECEITA).toContain(VERDE_RECEITA);
  });

  test("é a grade geral + o verde na frente — nada mais muda", () => {
    expect(CORES_FONTE_RECEITA).toEqual([VERDE_RECEITA, ...CORES_CATEGORIA]);
  });
});

describe("CORES_CATEGORIA — a grade geral (despesa/veículo) continua sem verde", () => {
  test("não inclui o verde de Receita", () => {
    expect(CORES_CATEGORIA).not.toContain(VERDE_RECEITA);
  });
});
