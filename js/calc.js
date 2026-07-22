// Funções puras de cálculo financeiro — sem dependência de Firebase/DOM,
// de propósito, pra dar pra testar sem mock (ver test/calc.test.js).
// Formato de um lançamento: { descricao, valor, tipo: 'receita'|'despesa', categoria, data: 'YYYY-MM-DD' }

export function saldo(lancamentos) {
  return lancamentos.reduce((acc, l) => {
    return acc + (l.tipo === "receita" ? l.valor : -l.valor);
  }, 0);
}

export function totalPorTipo(lancamentos, tipo) {
  return lancamentos
    .filter((l) => l.tipo === tipo)
    .reduce((acc, l) => acc + l.valor, 0);
}

export function totalPorCategoria(lancamentos, categoria) {
  return lancamentos
    .filter((l) => l.tipo === "despesa" && l.categoria === categoria)
    .reduce((acc, l) => acc + l.valor, 0);
}

export function agruparDespesasPorCategoria(lancamentos) {
  const totais = {};
  for (const l of lancamentos) {
    if (l.tipo !== "despesa") continue;
    const cat = l.categoria || "Sem categoria";
    totais[cat] = (totais[cat] || 0) + l.valor;
  }
  return totais;
}

function mesDoLancamento(l) {
  // "data" é sempre 'YYYY-MM-DD' — evita parsing de Date/timezone
  return l.data.slice(0, 7);
}

export function resumoMes(lancamentos, anoMes) {
  const doMes = lancamentos.filter((l) => mesDoLancamento(l) === anoMes);
  const receitas = totalPorTipo(doMes, "receita");
  const despesas = totalPorTipo(doMes, "despesa");
  return { receitas, despesas, saldo: receitas - despesas };
}
