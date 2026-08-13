import { describe, expect, test } from "vitest";
import type { DespesaCorrente } from "../types";
import { despesasNosTotais } from "./calculos";
import { ehReembolso, liquidoDaDespesa, reembolsosDe } from "./reembolsos";

/** O caso real que motivou isto: 100 € de jantar em grupo, 75 € devolvidos. */
const jantar: DespesaCorrente = {
  id: "d1",
  descricao: "Restaurante",
  valor: 10000,
  data: "2026-08-03",
  categoria: "Restaurante",
};

const reembolso = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente => ({
  id: "r1",
  descricao: "Reembolso jantar",
  // NEGATIVO: é assim que a categoria neta sozinha em todo o resto do app.
  valor: -7500,
  data: "2026-08-05",
  categoria: "Restaurante",
  origem: "reemb",
  reembolsoDeId: "d1",
  ...extra,
});

describe("ehReembolso", () => {
  test("reconhece pela origem, não pelo sinal do valor", () => {
    // O negativo é consequência de ser reembolso, não a definição. Um estorno
    // cancelado (0,00) continua a ser um reembolso.
    expect(ehReembolso({ origem: "reemb" })).toBe(true);
    expect(ehReembolso({ origem: undefined })).toBe(false);
    expect(ehReembolso({ origem: "fat" })).toBe(false);
    expect(ehReembolso({ origem: "parc" })).toBe(false);
  });
});

describe("reembolsosDe", () => {
  test("junta só os que apontam para esta despesa", () => {
    const outro = reembolso({ id: "r2", reembolsoDeId: "d2" });
    const meu = reembolso();
    expect(reembolsosDe([jantar, meu, outro], "d1")).toEqual([meu]);
  });

  test("uma despesa comum na mesma categoria não conta como reembolso dela", () => {
    // Sem o filtro por origem, qualquer despesa de "Restaurante" com o campo
    // por acaso preenchido entrava na conta.
    const comum: DespesaCorrente = { ...jantar, id: "d9", reembolsoDeId: "d1" };
    expect(reembolsosDe([comum], "d1")).toEqual([]);
  });

  test("sem reembolsos devolve lista vazia", () => {
    expect(reembolsosDe([jantar], "d1")).toEqual([]);
  });
});

describe("liquidoDaDespesa", () => {
  test("reembolso parcial: sobra o que ficou por dividir", () => {
    // 100,00 pagos, 75,00 devolvidos → 25,00 foram mesmo desta pessoa.
    const r = liquidoDaDespesa(jantar, [jantar, reembolso()]);

    expect(r.bruto).toBe(10000);
    // Positivo, porque quem mostra isto escreve "75,00 reembolsado" e não
    // "-75,00 reembolsado".
    expect(r.reembolsado).toBe(7500);
    expect(r.liquido).toBe(2500);
    expect(r.temReembolso).toBe(true);
  });

  test("vários reembolsos da mesma despesa somam-se", () => {
    // Cada amigo devolve a sua parte, em dias diferentes.
    const r = liquidoDaDespesa(jantar, [
      jantar,
      reembolso({ id: "r1", valor: -2500 }),
      reembolso({ id: "r2", valor: -2500 }),
      reembolso({ id: "r3", valor: -2500 }),
    ]);

    expect(r.reembolsado).toBe(7500);
    expect(r.liquido).toBe(2500);
  });

  test("reembolso total: sobra zero, e continua a haver o que mostrar", () => {
    const r = liquidoDaDespesa(jantar, [jantar, reembolso({ valor: -10000 })]);

    expect(r.liquido).toBe(0);
    // `temReembolso` não é "sobrou alguma coisa": é "houve devolução". Sem
    // isto, uma despesa inteiramente reembolsada deixava de o dizer na linha.
    expect(r.temReembolso).toBe(true);
  });

  test("devolveram mais do que se pagou: o líquido fica negativo, sem trava", () => {
    // Acontece num estorno com juros ou num lançamento errado. Esconder o
    // negativo faria a linha mentir sobre o que está guardado; quem precisa de
    // o tratar (o donut) trata no seu sítio.
    const r = liquidoDaDespesa(jantar, [jantar, reembolso({ valor: -12000 })]);

    expect(r.reembolsado).toBe(12000);
    expect(r.liquido).toBe(-2000);
  });

  test("sem reembolsos: o líquido é o próprio valor e não há nada a mostrar", () => {
    const r = liquidoDaDespesa(jantar, [jantar]);

    expect(r.liquido).toBe(10000);
    expect(r.reembolsado).toBe(0);
    // É este falso que impede "0,00 reembolsado" de aparecer em todas as
    // despesas do mês.
    expect(r.temReembolso).toBe(false);
  });

  test("reembolso solto (sem vínculo) não é atribuído a despesa nenhuma", () => {
    // O campo é opcional de propósito: um estorno que chega semanas depois, de
    // uma compra que já ninguém identifica. Ele reduz a categoria à mesma —
    // só não aparece pendurado numa linha específica.
    const solto = reembolso({ id: "r9", reembolsoDeId: undefined });
    const r = liquidoDaDespesa(jantar, [jantar, solto]);

    expect(r.temReembolso).toBe(false);
    expect(r.liquido).toBe(10000);
  });
});

describe("o reembolso flui pelos totais em vez de ser excluído", () => {
  test("despesasNosTotais deixa passar 'reemb'", () => {
    // Ao contrário de 'fat', 'recon' e 'parc', que são excluídos por não serem
    // despesa real ou por já contarem noutro sítio, o reembolso EXISTE para
    // reduzir o total. Se entrasse na lista de exclusão, o jantar continuava a
    // contar 100,00 e o reembolso não fazia nada.
    const itens = [jantar, reembolso()];
    expect(despesasNosTotais(itens)).toEqual(itens);
  });

  test("o total do mês já vem líquido, sem ninguém somar reembolsos à mão", () => {
    const total = despesasNosTotais([jantar, reembolso()]).reduce((s, d) => s + d.valor, 0);
    expect(total).toBe(2500);
  });

  test("os outros três continuam excluídos", () => {
    const fat: DespesaCorrente = { ...jantar, id: "f1", origem: "fat" };
    const recon: DespesaCorrente = { ...jantar, id: "rc1", origem: "recon" };
    const parc: DespesaCorrente = { ...jantar, id: "p1", origem: "parc" };

    expect(despesasNosTotais([jantar, fat, recon, parc])).toEqual([jantar]);
  });
});
