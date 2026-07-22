import test from "node:test";
import assert from "node:assert/strict";
import {
  saldo,
  totalPorTipo,
  totalPorCategoria,
  agruparDespesasPorCategoria,
  resumoMes,
} from "../js/calc.js";

const exemplo = [
  { descricao: "Salário", valor: 2000, tipo: "receita", categoria: "Trabalho", data: "2026-07-01" },
  { descricao: "Mercado", valor: 300, tipo: "despesa", categoria: "Alimentação", data: "2026-07-05" },
  { descricao: "Restaurante", valor: 50, tipo: "despesa", categoria: "Alimentação", data: "2026-07-10" },
  { descricao: "Combustível", valor: 100, tipo: "despesa", categoria: "Transporte", data: "2026-06-20" },
];

test("saldo soma receitas e subtrai despesas", () => {
  assert.equal(saldo(exemplo), 2000 - 300 - 50 - 100);
});

test("saldo de lista vazia é zero", () => {
  assert.equal(saldo([]), 0);
});

test("totalPorTipo filtra corretamente", () => {
  assert.equal(totalPorTipo(exemplo, "receita"), 2000);
  assert.equal(totalPorTipo(exemplo, "despesa"), 450);
});

test("totalPorCategoria soma só despesas da categoria", () => {
  assert.equal(totalPorCategoria(exemplo, "Alimentação"), 350);
  assert.equal(totalPorCategoria(exemplo, "Transporte"), 100);
  assert.equal(totalPorCategoria(exemplo, "Categoria inexistente"), 0);
});

test("agruparDespesasPorCategoria ignora receitas", () => {
  const grupos = agruparDespesasPorCategoria(exemplo);
  assert.deepEqual(grupos, { Alimentação: 350, Transporte: 100 });
});

test("resumoMes filtra só o mês pedido (regressão: mês errado não pode vazar pro resumo)", () => {
  const jul = resumoMes(exemplo, "2026-07");
  assert.equal(jul.receitas, 2000);
  assert.equal(jul.despesas, 350);
  assert.equal(jul.saldo, 1650);

  const jun = resumoMes(exemplo, "2026-06");
  assert.equal(jun.receitas, 0);
  assert.equal(jun.despesas, 100);
  assert.equal(jun.saldo, -100);
});
