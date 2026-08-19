import { describe, expect, test } from "vitest";
import {
  agruparPorChave,
  anoDe,
  diaDoMes,
  diasDoMes,
  doMes,
  mediaMensal,
  MESES_CURTOS_PT,
  mesDe,
  mesDoAno,
  mesesRecentes,
  ordenarPorDataDesc,
  receitasNosTotais,
  resumoMes,
  rotuloMes,
  rotuloVariacao,
  saldoTotal,
  somarMeses,
  total,
  totalDoMes,
  variacaoMensal,
} from "./calculos";

const receitas = [
  { valor: 200000, data: "2026-07-01" },
  { valor: 120000, data: "2026-07-15" },
  { valor: 90000, data: "2026-06-28" },
];

const despesas = [
  { valor: 30000, data: "2026-07-05" },
  { valor: 5000, data: "2026-07-10" },
  { valor: 10000, data: "2026-06-20" },
];

test("mesDe corta a string sem passar por Date", () => {
  expect(mesDe("2026-07-23")).toBe("2026-07");
});

test("total soma centavos e lista vazia dá zero", () => {
  expect(total(despesas)).toBe(45000);
  expect(total([])).toBe(0);
});

test("doMes/totalDoMes filtram só o mês pedido", () => {
  expect(doMes(receitas, "2026-07")).toHaveLength(2);
  expect(totalDoMes(receitas, "2026-07")).toBe(320000);
  expect(totalDoMes(receitas, "2026-05")).toBe(0);
});

describe("receitasNosTotais — espelho de despesasNosTotais", () => {
  const salario = { valor: 200000, data: "2026-07-01", origem: undefined };
  const ajuste = { valor: 1250, data: "2026-07-31", origem: "recon" };

  test("ajuste de reconciliação fica fora — não é dinheiro recebido", () => {
    expect(receitasNosTotais([salario, ajuste])).toEqual([salario]);
    expect(totalDoMes(receitasNosTotais([salario, ajuste]), "2026-07")).toBe(200000);
  });

  test("só 'recon' é excluído: 'fat' e 'parc' são casos da despesa, não da receita", () => {
    const comOutraOrigem = [
      { valor: 100, data: "2026-07-02", origem: "fat" },
      { valor: 200, data: "2026-07-03", origem: "parc" },
    ];
    expect(receitasNosTotais(comOutraOrigem)).toEqual(comOutraOrigem);
  });
});

describe("resumoMes (regressão do app antigo: mês errado não pode vazar)", () => {
  test("julho", () => {
    expect(resumoMes(receitas, despesas, "2026-07")).toEqual({
      receitas: 320000,
      despesas: 35000,
      saldo: 285000,
    });
  });

  test("junho fica negativo sem vazar julho", () => {
    expect(resumoMes(receitas, despesas, "2026-06")).toEqual({
      receitas: 90000,
      despesas: 10000,
      saldo: 80000,
    });
  });

  test("mês sem lançamentos zera tudo", () => {
    expect(resumoMes(receitas, despesas, "2025-01")).toEqual({
      receitas: 0,
      despesas: 0,
      saldo: 0,
    });
  });
});

test("saldoTotal acumula tudo", () => {
  expect(saldoTotal(receitas, despesas)).toBe(410000 - 45000);
});

test("ordenarPorDataDesc não muta a lista original", () => {
  const ordenada = ordenarPorDataDesc(despesas);
  expect(ordenada.map((d) => d.data)).toEqual(["2026-07-10", "2026-07-05", "2026-06-20"]);
  expect(despesas[0].data).toBe("2026-07-05");
});

describe("ano e mês para a grade de escolha de mês", () => {
  test("anoDe lê o ano sem passar por Date", () => {
    expect(anoDe("2026-07")).toBe(2026);
    expect(anoDe("1999-12")).toBe(1999);
  });

  test("mesDoAno monta o YearMonth com o zero à esquerda", () => {
    expect(mesDoAno(2026, 1)).toBe("2026-01");
    expect(mesDoAno(2026, 12)).toBe("2026-12");
  });

  test("os dois são o inverso um do outro em todos os meses do ano", () => {
    for (let m = 1; m <= 12; m++) {
      const ym = mesDoAno(2026, m);
      expect(anoDe(ym)).toBe(2026);
      expect(rotuloMes(ym).endsWith("2026")).toBe(true);
    }
  });

  test("os 12 rótulos curtos são distintos e batem com o nome inteiro", () => {
    expect(MESES_CURTOS_PT).toHaveLength(12);
    expect(new Set(MESES_CURTOS_PT).size).toBe(12);
    for (let m = 1; m <= 12; m++) {
      expect(rotuloMes(mesDoAno(2026, m)).startsWith(MESES_CURTOS_PT[m - 1])).toBe(true);
    }
  });
});

describe("variacaoMensal", () => {
  test("sobe, desce e fica igual", () => {
    expect(variacaoMensal(120000, 100000)).toBe(20);
    expect(variacaoMensal(80000, 100000)).toBe(-20);
    expect(variacaoMensal(100000, 100000)).toBe(0);
  });

  test("arredonda ao inteiro", () => {
    // 1/3 a mais → 33,33…% → 33%.
    expect(variacaoMensal(40000, 30000)).toBe(33);
  });

  test("mês anterior zerado não dá Infinity nem NaN — dá null", () => {
    // O primeiro mês de uso do app: não há contra o que comparar.
    expect(variacaoMensal(50000, 0)).toBeNull();
    expect(variacaoMensal(0, 0)).toBeNull();
  });

  test("mês anterior negativo também não serve de base", () => {
    // Acontece com um reembolso maior que os gastos do mês. Contra -100 um
    // gasto de 50 dava "-150%", que se lê como uma queda quando foi subida.
    expect(variacaoMensal(5000, -10000)).toBeNull();
  });
});

describe("rotuloVariacao", () => {
  test("o sinal é explícito na subida", () => {
    expect(rotuloVariacao(12)).toBe("+12%");
    expect(rotuloVariacao(-8)).toBe("-8%");
    expect(rotuloVariacao(0)).toBe("0%");
  });
});

describe("mediaMensal", () => {
  const tres = ["2026-04", "2026-05", "2026-06"];

  test("histórico completo: média dos três meses", () => {
    const itens = [
      { valor: 100000, data: "2026-04-10" },
      { valor: 200000, data: "2026-05-10" },
      { valor: 300000, data: "2026-06-10" },
    ];
    expect(mediaMensal(itens, tres)).toEqual({ media: 200000, meses: 3 });
  });

  test("mês vazio DEPOIS do início conta como zero verdadeiro", () => {
    // Abril e junho com dinheiro, maio sem nada: maio existiu, e a média tem
    // de o sentir.
    const itens = [
      { valor: 300000, data: "2026-04-10" },
      { valor: 300000, data: "2026-06-10" },
    ];
    expect(mediaMensal(itens, tres)).toEqual({ media: 200000, meses: 3 });
  });

  test("app novo: divide pelos meses que existiram, não por três", () => {
    // Só junho tem história. Dividir por 3 daria 100000 — um terço do que a
    // pessoa recebe, apresentado como a referência dela.
    const soUm = [{ valor: 300000, data: "2026-06-10" }];
    expect(mediaMensal(soUm, tres)).toEqual({ media: 300000, meses: 1 });

    const dois = [
      { valor: 300000, data: "2026-05-10" },
      { valor: 100000, data: "2026-06-10" },
    ];
    expect(mediaMensal(dois, tres)).toEqual({ media: 200000, meses: 2 });
  });

  test("sem nenhuma história na janela, é null", () => {
    expect(mediaMensal([], tres)).toBeNull();
    // Tudo posterior à janela pedida: o app começou depois dela.
    expect(mediaMensal([{ valor: 300000, data: "2026-07-10" }], tres)).toBeNull();
  });

  test("a janela dos 3 meses ANTERIORES ao exibido não inclui o exibido", () => {
    // A decisão de desenho do cartão: o mês em curso está incompleto e puxava
    // a média para baixo todo dia 1. `mesesRecentes(3, somarMeses(mes, -1))`.
    expect(mesesRecentes(3, somarMeses("2026-07", -1))).toEqual(["2026-04", "2026-05", "2026-06"]);
  });
});

describe("diasDoMes", () => {
  test("os meses de 31 e de 30 dias", () => {
    expect(diasDoMes("2026-01")).toBe(31);
    expect(diasDoMes("2026-04")).toBe(30);
    expect(diasDoMes("2026-07")).toBe(31);
    expect(diasDoMes("2026-11")).toBe(30);
    expect(diasDoMes("2026-12")).toBe(31);
  });

  test("fevereiro: 28 num ano comum, 29 num bissexto", () => {
    expect(diasDoMes("2026-02")).toBe(28);
    expect(diasDoMes("2024-02")).toBe(29);
    // As duas exceções da regra dos 100/400 anos, que uma conta escrita à mão
    // costuma falhar.
    expect(diasDoMes("1900-02")).toBe(28);
    expect(diasDoMes("2000-02")).toBe(29);
  });

  test("é a mesma conta que prende um vencimento a 31 ao fim do mês", () => {
    // `diaDoMes` passou a usar esta função em vez de repetir o cálculo — se as
    // duas divergirem, um vencimento a 31 escorrega para o mês seguinte.
    for (const ym of ["2026-01", "2026-02", "2024-02", "2026-04"]) {
      expect(diaDoMes(ym, 31)).toBe(`${ym}-${String(diasDoMes(ym)).padStart(2, "0")}`);
    }
  });
});

// Usado pelo KPI "Maior fonte" de Receitas, no lugar de uma contagem de
// lançamentos que só repetia a lista logo abaixo.
describe("agruparPorChave", () => {
  const receitas = [
    { valor: 150000, data: "2026-07-05", fonte: "Trabalho" },
    { valor: 30000, data: "2026-07-10", fonte: "Uber" },
    { valor: 20000, data: "2026-07-20", fonte: "Uber" },
  ];

  test("soma por chave e ordena da maior pra menor, com a percentagem", () => {
    const grupos = agruparPorChave(receitas, (r) => r.fonte);
    expect(grupos).toEqual([
      { nome: "Trabalho", valor: 150000, pct: 75 },
      { nome: "Uber", valor: 50000, pct: 25 },
    ]);
  });

  test("lista vazia dá lista vazia — quem chama decide o que mostrar", () => {
    expect(agruparPorChave([], (i: { valor: number; data: string }) => String(i.valor))).toEqual(
      [],
    );
  });

  test("grupo que fecha a zero ou abaixo fica de fora", () => {
    // Um estorno que devolve tudo: a fonte deixa de existir no mês em vez de
    // aparecer com 0% ou negativa.
    const grupos = agruparPorChave(
      [
        { valor: 10000, data: "2026-07-01", fonte: "Extra" },
        { valor: -10000, data: "2026-07-02", fonte: "Extra" },
        { valor: 5000, data: "2026-07-03", fonte: "Trabalho" },
      ],
      (r) => r.fonte,
    );
    expect(grupos.map((g) => g.nome)).toEqual(["Trabalho"]);
  });
});
