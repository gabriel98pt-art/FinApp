import { describe, expect, test } from "vitest";
import type { DadosVeiculo, DespesaCorrente, DespesaFixa, Parcela } from "../types";
import {
  despesaPorCategoriaMes,
  despesaPorCategoriaRegistradaMes,
  maiorCategoriaRelevante,
  paradasDonut,
  totalDasFatias,
} from "./despesaPorCategoria";

function corrente(extra: Partial<DespesaCorrente> = {}): DespesaCorrente {
  return {
    id: "d1",
    descricao: "Compra",
    valor: 1000,
    data: "2026-07-10",
    categoria: "Alimentação",
    ...extra,
  };
}

function fixa(extra: Partial<DespesaFixa> = {}): DespesaFixa {
  return {
    id: "f1",
    descricao: "Aluguel",
    valor: 45000,
    categoria: "Casa",
    pagoPorMes: {},
    ...extra,
  };
}

const SEM_VEICULO: DadosVeiculo = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};

describe("despesaPorCategoriaMes", () => {
  test("agrupa por categoria e ordena da maior fatia pra menor", () => {
    const despesas = [
      corrente({ id: "d1", valor: 3000, categoria: "Alimentação" }),
      corrente({ id: "d2", valor: 1000, categoria: "Alimentação" }),
      corrente({ id: "d3", valor: 6000, categoria: "Lazer" }),
    ];
    const fatias = despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias.map((f) => [f.categoria, f.valor])).toEqual([
      ["Lazer", 6000],
      ["Alimentação", 4000],
    ]);
    expect(fatias.map((f) => f.pct)).toEqual([60, 40]);
    expect(totalDasFatias(fatias)).toBe(10000);
  });

  test("ignora outro mês, pagamento de fatura e o espelho da parcela", () => {
    const despesas = [
      corrente({ id: "d1", valor: 1000, data: "2026-06-30" }), // outro mês
      corrente({ id: "d2", valor: 5000, categoria: "Cartão", origem: "fat" }), // fatura
      corrente({ id: "d3", valor: 2000, categoria: "Compras", origem: "parc" }), // espelho
      corrente({ id: "d4", valor: 800, categoria: "Lazer" }),
    ];
    const fatias = despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Lazer", valor: 800, pct: 100 }]);
  });

  test("parcela entra pelo plano, na categoria dela — sem duplicar com o espelho", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        pagoPorMes: { "2026-07": true },
      },
    ];
    const espelho = [corrente({ id: "d1", valor: 10000, categoria: "Casa", origem: "parc" })];
    const fatias = despesaPorCategoriaMes(espelho, [], p, SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Casa", valor: 10000, pct: 100 }]);
  });

  test("mês fechado: parcela pendente entra cheia; mês corrente, não", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        pagoPorMes: {},
      },
    ];
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-09")).toEqual([
      { categoria: "Parcelas", valor: 10000, pct: 100 },
    ]);
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
  });

  // Ninguém marca uma parcela em débito automático — o botão "Pagar mês" nem
  // aparece para ela. Sem tratar isso, ela sumia do donut no mês corrente.
  test("mês corrente: parcela em débito automático entra sem marcação", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-06",
        categoria: "Casa",
        cartao: "AB Gold (C)",
        autoDebit: true,
        pagoPorMes: {},
      },
    ];
    expect(despesaPorCategoriaMes([], [], p, SEM_VEICULO, "2026-07", "2026-07")).toEqual([
      { categoria: "Casa", valor: 10000, pct: 100 },
    ]);
  });

  test("mês futuro: parcela entra cheia mesmo pendente e sem débito automático", () => {
    const p: Parcela[] = [
      {
        id: "p1",
        descricao: "Sofá",
        total: 30000,
        numParcelas: 3,
        primeiroMes: "2026-08",
        categoria: "Casa",
        pagoPorMes: {},
      },
    ];
    // Vendo setembro (mês futuro, mas dentro do plano) com hoje em agosto.
    const fatias = despesaPorCategoriaMes(
      [],
      [],
      p,
      SEM_VEICULO,
      "2026-09",
      "2026-08",
      "2026-08-18",
    );
    expect(fatias).toEqual([{ categoria: "Casa", valor: 10000, pct: 100 }]);
  });

  // Mesma regra das parcelas acima, que as fixas gerais não seguiam: entravam
  // cheias mesmo pendentes e o donut mostrava dinheiro que ainda não saiu.
  test("mês corrente: fixa pendente (sem débito automático) fica de fora", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, categoria: "Casa", pagoPorMes: {} }),
      fixa({ id: "f2", valor: 999, categoria: "Assinaturas", inicio: "2026-08" }),
    ];
    expect(despesaPorCategoriaMes([], fixas, [], SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
  });

  test("mês corrente: fixa marcada à mão entra cheia; fora da janela não entra", () => {
    const fixas = [
      fixa({ id: "f1", valor: 45000, categoria: "Casa", pagoPorMes: { "2026-07": true } }),
      fixa({ id: "f2", valor: 999, categoria: "Assinaturas", inicio: "2026-08" }),
    ];
    const fatias = despesaPorCategoriaMes([], fixas, [], SEM_VEICULO, "2026-07", "2026-07");
    expect(fatias).toEqual([{ categoria: "Casa", valor: 45000, pct: 100 }]);
  });

  test("mês fechado: fixa pendente entra cheia", () => {
    const fixas = [fixa({ id: "f1", valor: 45000, categoria: "Casa", pagoPorMes: {} })];
    expect(despesaPorCategoriaMes([], fixas, [], SEM_VEICULO, "2026-07", "2026-09")).toEqual([
      { categoria: "Casa", valor: 45000, pct: 100 },
    ]);
  });

  // O gate `ym === mesReal` só protege o mês CORRENTE — um mês futuro (ainda
  // por chegar) cai no mesmo ramo que um mês fechado: entra cheio, pago ou
  // não, débito automático ou manual. Não dá pra pedir "já venceu?" ou "já
  // marcou como pago?" de um mês que ainda nem começou — a única resposta que
  // faz sentido pra alguém a planejar setembro em agosto é o valor cheio do
  // compromisso, exatamente como as parcelas já faziam antes desta fixa
  // acompanhar a mesma regra.
  test("mês futuro: fixa entra cheia, tanto em débito automático quanto manual", () => {
    const fixas = [
      fixa({ id: "f1", valor: 4500, categoria: "Telemóvel", contaCartao: "Visa", autoDebit: true }),
      fixa({ id: "f2", valor: 35000, categoria: "Casa", pagoPorMes: {} }),
    ];
    // Vendo setembro (mês futuro) enquanto "hoje" ainda está em agosto.
    const fatias = despesaPorCategoriaMes(
      [],
      fixas,
      [],
      SEM_VEICULO,
      "2026-09",
      "2026-08",
      "2026-08-18",
    );
    expect(fatias).toEqual([
      { categoria: "Casa", valor: 35000, pct: 89 },
      { categoria: "Telemóvel", valor: 4500, pct: 11 },
    ]);
  });

  // Ninguém marca uma fixa em débito automático — igual às parcelas.
  test("mês corrente: fixa em débito automático segue o dia de vencimento", () => {
    const fixas = [
      fixa({
        id: "f1",
        valor: 45000,
        categoria: "Telemóvel",
        contaCartao: "Visa",
        autoDebit: true,
        diaVencimento: 27,
        pagoPorMes: {},
      }),
    ];
    const telemovelEm = (hoje: string) =>
      despesaPorCategoriaMes([], fixas, [], SEM_VEICULO, "2026-07", "2026-07", hoje).find(
        (f) => f.categoria === "Telemóvel",
      );
    expect(telemovelEm("2026-07-18")).toBeUndefined();
    expect(telemovelEm("2026-07-27")?.valor).toBe(45000);
  });

  test("veículo entra como uma fatia só (cargas + despesas + fixas pagas)", () => {
    const veiculo: DadosVeiculo = {
      cargas: [
        { id: "c1", data: "2026-07-05", kwh: 30, precoKwh: 20, custo: 600, local: "Casa" },
        { id: "c2", data: "2026-06-05", kwh: 30, precoKwh: 20, custo: 600, local: "Casa" },
      ],
      despesas: [{ id: "v1", data: "2026-07-08", valor: 1500, categoria: "Portagens" }],
      despesasFixas: [
        fixa({ id: "vf1", valor: 5000, categoria: "Seguro", pagoPorMes: { "2026-07": true } }),
      ],
      quilometragem: [],
    };
    const fatias = despesaPorCategoriaMes([], [], [], veiculo, "2026-07", "2026-07");
    // 600 (carga de julho) + 1500 + 5000 — a carga de junho fica fora
    expect(fatias).toEqual([{ categoria: "Veículo", valor: 7100, pct: 100 }]);
  });

  test("mês sem nada dá lista vazia (donut mostra o estado vazio)", () => {
    expect(despesaPorCategoriaMes([], [], [], SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
    expect(totalDasFatias([])).toBe(0);
  });

  test("categoria com total zero não vira fatia", () => {
    const despesas = [corrente({ id: "d1", valor: 0, categoria: "Lazer" })];
    expect(despesaPorCategoriaMes(despesas, [], [], SEM_VEICULO, "2026-07", "2026-07")).toEqual([]);
  });
});

describe("paradasDonut", () => {
  test("fatias emendam sem sobra e a última fecha em 100%", () => {
    const fatias = [
      { categoria: "Lazer", valor: 6000, pct: 60 },
      { categoria: "Casa", valor: 4000, pct: 40 },
    ];
    expect(paradasDonut(fatias, ["#a", "#b"])).toEqual([
      "#a 0.000% 60.000%",
      "#b 60.000% 100.000%",
    ]);
  });

  test("três fatias com resto de arredondamento ainda fecham em 100%", () => {
    const fatias = [
      { categoria: "A", valor: 1, pct: 33 },
      { categoria: "B", valor: 1, pct: 33 },
      { categoria: "C", valor: 1, pct: 33 },
    ];
    const paradas = paradasDonut(fatias, ["#a", "#b", "#c"]);
    expect(paradas[0]).toBe("#a 0.000% 33.333%");
    expect(paradas[2].endsWith("100.000%")).toBe(true);
  });

  test("sem fatias não gera gradiente", () => {
    expect(paradasDonut([], [])).toEqual([]);
  });

  describe("com gapPct — separador entre fatias (achado da auditoria de Design)", () => {
    test("abre respiro nas duas bordas de cada fatia, inclusive fechando o círculo", () => {
      const fatias = [
        { categoria: "Lazer", valor: 6000, pct: 60 },
        { categoria: "Casa", valor: 4000, pct: 40 },
      ];
      expect(paradasDonut(fatias, ["#a", "#b"], 1)).toEqual([
        "var(--s1) 0.000% 0.500%",
        "#a 0.500% 59.500%",
        "var(--s1) 59.500% 60.500%",
        "#b 60.500% 99.500%",
        "var(--s1) 99.500% 100.000%",
      ]);
    });

    test("aceita uma cor de separador própria", () => {
      const fatias = [
        { categoria: "A", valor: 1, pct: 50 },
        { categoria: "B", valor: 1, pct: 50 },
      ];
      const paradas = paradasDonut(fatias, ["#a", "#b"], 2, "#fundo");
      expect(paradas.filter((p) => p.startsWith("#fundo"))).toHaveLength(3);
    });

    test("uma fatia só não ganha separador — não há fronteira nenhuma", () => {
      const fatias = [{ categoria: "Único", valor: 100, pct: 100 }];
      expect(paradasDonut(fatias, ["#a"], 1)).toEqual(["#a 0.000% 100.000%"]);
    });

    test("fatia mais fina que o gap fica inteira, sem inverter a faixa", () => {
      const fatias = [
        { categoria: "Grande", valor: 990, pct: 99 },
        { categoria: "Minúscula", valor: 10, pct: 1 },
      ];
      const paradas = paradasDonut(fatias, ["#a", "#b"], 4);
      // A fatia de 1% (menor que o gap de 4) aparece inteira — nenhuma parada
      // com "#b" tem início maior que o fim.
      const daMinuscula = paradas.find((p) => p.startsWith("#b"))!;
      const [, inicio, fim] = daMinuscula.match(/([\d.]+)% ([\d.]+)%/)!;
      expect(Number(inicio)).toBeLessThan(Number(fim));
    });

    test("gapPct=0 (padrão) continua idêntico ao comportamento de sempre", () => {
      const fatias = [
        { categoria: "Lazer", valor: 6000, pct: 60 },
        { categoria: "Casa", valor: 4000, pct: 40 },
      ];
      expect(paradasDonut(fatias, ["#a", "#b"])).toEqual(paradasDonut(fatias, ["#a", "#b"], 0));
    });
  });
});

describe("maiorCategoriaRelevante — o que o card de Despesas mostra", () => {
  const fatia = (categoria: string, valor: number) => ({ categoria, valor, pct: 0 });

  test("ignora o veículo e a família aluguel, mesmo sendo as maiores", () => {
    const fatias = [
      fatia("Veículo", 90000),
      fatia("Casa", 80000),
      fatia("Alimentação", 42000),
      fatia("Lazer", 18000),
    ];
    expect(maiorCategoriaRelevante(fatias)?.categoria).toBe("Alimentação");
  });

  test("os sinónimos de aluguel saem todos, com ou sem acento", () => {
    for (const nome of [
      "Casa",
      "Habitação",
      "habitacao",
      "Renda",
      "Aluguer",
      "ALUGUER",
      "Aluguel", // grafia pt-BR — faltava na lista, categoria real ficava de fora
      "aluguel",
    ]) {
      expect(maiorCategoriaRelevante([fatia(nome, 90000), fatia("Lazer", 100)])?.categoria).toBe(
        "Lazer",
      );
    }
  });

  test("devolve null quando só sobram as excluídas", () => {
    expect(maiorCategoriaRelevante([fatia("Veículo", 500), fatia("Renda", 900)])).toBeNull();
    expect(maiorCategoriaRelevante([])).toBeNull();
  });

  test("mantém a ordem que já vinha (maior primeiro)", () => {
    const fatias = [fatia("Compras", 30000), fatia("Saúde", 20000)];
    expect(maiorCategoriaRelevante(fatias)?.valor).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// Reembolso: uma despesa negativa na mesma categoria, que a reduz.
// ---------------------------------------------------------------------------

describe("categorias com reembolso", () => {
  const jantar = corrente({
    id: "d1",
    descricao: "Restaurante",
    valor: 10000,
    categoria: "Restaurante",
  });

  const devolvido = (valor: number, extra: Partial<DespesaCorrente> = {}) =>
    corrente({
      id: "r1",
      descricao: "Reembolso jantar",
      valor: -valor,
      categoria: "Restaurante",
      origem: "reemb",
      reembolsoDeId: "d1",
      ...extra,
    });

  test("reembolso parcial: a categoria aparece com o valor LÍQUIDO", () => {
    // 100,00 de jantar, 75,00 devolvidos → o donut mostra 25,00, que é o que
    // esta pessoa gastou de facto. Sem netar, mostraria 100,00 e a fatia
    // maior do mês seria uma despesa que ela não teve.
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(7500)],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(fatias).toEqual([{ categoria: "Restaurante", valor: 2500, pct: 100 }]);
  });

  test("reembolso total: a categoria SOME do donut", () => {
    // Uma fatia de 0% não desenha nada mas ocupa uma cor e uma linha de
    // legenda — lixo visual sobre uma despesa que deixou de existir.
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(10000)],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(fatias).toEqual([]);
  });

  test("devolveram mais do que se gastou: a categoria também some", () => {
    // Estorno com juros, ou lançamento errado. Uma fatia negativa desenharia
    // o gradiente ao contrário e o total do donut deixava de bater com a soma
    // das fatias visíveis.
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(12000)],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(fatias).toEqual([]);
  });

  test("uma categoria zerada não estraga as percentagens das outras", () => {
    // O que importa é o total do donut passar a ser só o das fatias visíveis:
    // com a categoria zerada a contar para o total, as outras encolhiam e a
    // soma das percentagens não fechava em 100.
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(10000), corrente({ id: "d2", valor: 5000, categoria: "Alimentação" })],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(fatias).toEqual([{ categoria: "Alimentação", valor: 5000, pct: 100 }]);
  });

  test("reembolso solto (sem vínculo) reduz a categoria à mesma", () => {
    // O vínculo serve para a linha da despesa mostrar o líquido; a redução da
    // categoria não depende dele.
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(4000, { reembolsoDeId: undefined })],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(fatias).toEqual([{ categoria: "Restaurante", valor: 6000, pct: 100 }]);
  });

  test("reembolso noutra categoria não mexe na categoria do jantar", () => {
    const fatias = despesaPorCategoriaMes(
      [jantar, devolvido(4000, { categoria: "Alimentação", reembolsoDeId: undefined })],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    // "Alimentação" ficaria a -40,00 e sai; "Restaurante" fica intacta.
    expect(fatias).toEqual([{ categoria: "Restaurante", valor: 10000, pct: 100 }]);
  });
});

describe("maiorCategoriaRelevante com reembolso", () => {
  test("não escolhe uma categoria que o reembolso zerou", () => {
    // Ela já nem chega aqui — sai no filtro do donut. O teste existe porque
    // esta função lê `fatias[0]` sem verificar nada, e é o card "Maior
    // categoria" de Despesas que a consome.
    const fatias = despesaPorCategoriaMes(
      [
        corrente({ id: "d1", valor: 10000, categoria: "Restaurante" }),
        corrente({
          id: "r1",
          valor: -10000,
          categoria: "Restaurante",
          origem: "reemb",
          reembolsoDeId: "d1",
        }),
        corrente({ id: "d2", valor: 3000, categoria: "Alimentação" }),
      ],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(maiorCategoriaRelevante(fatias)?.categoria).toBe("Alimentação");
  });

  test("com tudo reembolsado, não há maior categoria nenhuma", () => {
    const fatias = despesaPorCategoriaMes(
      [
        corrente({ id: "d1", valor: 10000, categoria: "Restaurante" }),
        corrente({
          id: "r1",
          valor: -10000,
          categoria: "Restaurante",
          origem: "reemb",
          reembolsoDeId: "d1",
        }),
      ],
      [],
      [],
      SEM_VEICULO,
      "2026-07",
      "2026-07",
    );

    expect(maiorCategoriaRelevante(fatias)).toBeNull();
  });
});

// A mesma precisão de DIA que `statusOrcamentoMes` ganhou — o donut sofria do
// mesmo: a categoria de uma parcela em débito automático inchava desde o dia 1
// do mês, antes de o dinheiro sair.
describe("despesaPorCategoriaMes — precisão de dia no mês corrente", () => {
  const MES = "2026-07";

  const parcelaAuto = (extra: Partial<Parcela> = {}): Parcela => ({
    id: "p1",
    descricao: "Consola",
    total: 30000,
    numParcelas: 3,
    primeiroMes: MES,
    categoria: "Lazer",
    cartao: "Visa",
    autoDebit: true,
    diaVencimento: 20,
    pagoPorMes: {},
    ...extra,
  });

  const lazerEm = (hoje?: string) =>
    despesaPorCategoriaMes([], [], [parcelaAuto()], SEM_VEICULO, MES, MES, hoje).find(
      (f) => f.categoria === "Lazer",
    );

  test("antes do vencimento a fatia nem existe", () => {
    expect(lazerEm("2026-07-05")).toBeUndefined();
  });

  test("no dia do vencimento a fatia aparece", () => {
    expect(lazerEm("2026-07-20")?.valor).toBe(10000);
  });

  test("depois do vencimento a fatia aparece", () => {
    expect(lazerEm("2026-07-25")?.valor).toBe(10000);
  });

  test("sem `hoje`, mantém o comportamento antigo: mês inteiro de uma vez", () => {
    expect(lazerEm(undefined)?.valor).toBe(10000);
  });

  test("mês já fechado conta sem olhar o dia", () => {
    const p = parcelaAuto({ primeiroMes: "2026-06" });
    const fatias = despesaPorCategoriaMes([], [], [p], SEM_VEICULO, "2026-06", MES, "2026-07-01");
    expect(fatias.find((f) => f.categoria === "Lazer")?.valor).toBe(10000);
  });

  test("a fixa do veículo segue a mesma regra de dia", () => {
    // Metade da correção seria só tratar as parcelas: a fatia "Veículo" vem de
    // `totalVeiculoMes`, que também recebe `hoje` — e `despesaRealizadaMes` já
    // lho passava. Sem isto, o donut continuava a discordar do KPI.
    const veiculo: DadosVeiculo = {
      cargas: [],
      despesas: [],
      despesasFixas: [
        {
          id: "fv1",
          descricao: "Seguro",
          valor: 8000,
          diaVencimento: 20,
          autoDebit: true,
          contaCartao: "Visa",
          pagoPorMes: {},
        },
      ],
      quilometragem: [],
    } as unknown as DadosVeiculo;

    const veiculoEm = (hoje: string) =>
      despesaPorCategoriaMes([], [], [], veiculo, MES, MES, hoje).find(
        (f) => f.categoria === "Veículo",
      );
    expect(veiculoEm("2026-07-05")).toBeUndefined();
    expect(veiculoEm("2026-07-25")?.valor).toBe(8000);
  });
});

// Bug relatado pelo Gabriel em 01/09/2026, depois de já ter o KPI "Despesas"
// corrigido: o donut de categorias, NA MESMA TELA (Início), continuava preso
// ao cronograma — uma parcela paga com atraso entrava no total mas sumia da
// categoria dela. As duas contas da mesma página têm de bater.
describe("despesaPorCategoriaRegistradaMes — fluxo de caixa, mesmo par do KPI", () => {
  test("soma despesas correntes pela data real, por categoria", () => {
    const despesas = [
      corrente({ id: "d1", valor: 3000, categoria: "Alimentação", data: "2026-09-05" }),
      corrente({ id: "d2", valor: 6000, categoria: "Lazer", data: "2026-09-06" }),
    ];
    const fatias = despesaPorCategoriaRegistradaMes(despesas, [], SEM_VEICULO, "2026-09");
    expect(fatias.map((f) => [f.categoria, f.valor])).toEqual([
      ["Lazer", 6000],
      ["Alimentação", 3000],
    ]);
  });

  test("'fat' e 'recon' ficam de fora", () => {
    const despesas = [
      corrente({ id: "d1", valor: 5000, categoria: "Cartão", origem: "fat", data: "2026-09-05" }),
      corrente({ id: "d2", valor: 100, categoria: "Outros", origem: "recon", data: "2026-09-05" }),
    ];
    expect(despesaPorCategoriaRegistradaMes(despesas, [], SEM_VEICULO, "2026-09")).toEqual([]);
  });

  // O caso relatado: parcela do advogado, referente a Agosto, paga em
  // Setembro. O espelho tem a data real; a categoria segue a data, não o
  // `parcelaMes`.
  test("parcela paga com atraso entra na categoria dela, no mês em que foi paga", () => {
    const espelho = [
      corrente({
        id: "d1",
        descricao: "Advogado",
        valor: 30000,
        categoria: "Parcelas",
        data: "2026-09-01",
        origem: "parc",
        parcelaId: "p1",
        parcelaMes: "2026-08",
      }),
    ];
    expect(despesaPorCategoriaRegistradaMes(espelho, [], SEM_VEICULO, "2026-08")).toEqual([]);
    expect(despesaPorCategoriaRegistradaMes(espelho, [], SEM_VEICULO, "2026-09")).toEqual([
      { categoria: "Parcelas", valor: 30000, pct: 100 },
    ]);
  });

  test("fixa paga sem espelho (dado antigo) cai na categoria, no mês de vencimento", () => {
    const fixas = [fixa({ categoria: "Casa", valor: 45000, pagoPorMes: { "2026-06": true } })];
    expect(despesaPorCategoriaRegistradaMes([], fixas, SEM_VEICULO, "2026-06")).toEqual([
      { categoria: "Casa", valor: 45000, pct: 100 },
    ]);
    expect(despesaPorCategoriaRegistradaMes([], fixas, SEM_VEICULO, "2026-07")).toEqual([]);
  });

  test("fixa paga COM espelho conta na categoria, na data real do pagamento", () => {
    const fixas = [
      fixa({ id: "f1", categoria: "Casa", valor: 45000, pagoPorMes: { "2026-08": true } }),
    ];
    const espelho = [
      corrente({
        id: "d1",
        categoria: "Casa",
        valor: 45000,
        data: "2026-09-02",
        origem: "fixa",
        fixaId: "f1",
        fixaMes: "2026-08",
      }),
    ];
    expect(despesaPorCategoriaRegistradaMes(espelho, fixas, SEM_VEICULO, "2026-08")).toEqual([]);
    expect(despesaPorCategoriaRegistradaMes(espelho, fixas, SEM_VEICULO, "2026-09")).toEqual([
      { categoria: "Casa", valor: 45000, pct: 100 },
    ]);
  });

  // A recarga que o Gabriel lançou: carga do veículo, sempre "realizada" no
  // dia em que é registada — sem gate de pago/pendente, ao contrário das
  // fixas do veículo.
  test("carga do veículo entra na fatia 'Veículo' na data dela, sempre", () => {
    const veiculo: DadosVeiculo = {
      cargas: [{ id: "c1", data: "2026-09-10", kwh: 40, precoKwh: 25, custo: 1000, local: "Casa" }],
      despesas: [],
      despesasFixas: [],
      quilometragem: [],
    };
    expect(despesaPorCategoriaRegistradaMes([], [], veiculo, "2026-09")).toEqual([
      { categoria: "Veículo", valor: 1000, pct: 100 },
    ]);
  });

  test("despesa fixa do veículo segue a mesma regra de espelho/sem-espelho, na fatia 'Veículo'", () => {
    const semEspelho: DadosVeiculo = {
      cargas: [],
      despesas: [],
      despesasFixas: [
        {
          id: "f1",
          descricao: "Seguro",
          valor: 8000,
          categoria: "Veículo",
          pagoPorMes: { "2026-06": true },
        },
      ],
      quilometragem: [],
    };
    expect(despesaPorCategoriaRegistradaMes([], [], semEspelho, "2026-06")).toEqual([
      { categoria: "Veículo", valor: 8000, pct: 100 },
    ]);

    const comEspelho: DadosVeiculo = {
      cargas: [],
      despesas: [
        {
          id: "vd1",
          descricao: "Seguro",
          valor: 8000,
          data: "2026-07-03",
          categoria: "Veículo",
          origem: "fixa",
          fixaId: "f1",
          fixaMes: "2026-06",
        },
      ],
      despesasFixas: [
        {
          id: "f1",
          descricao: "Seguro",
          valor: 8000,
          categoria: "Veículo",
          pagoPorMes: { "2026-06": true },
        },
      ],
      quilometragem: [],
    };
    expect(despesaPorCategoriaRegistradaMes([], [], comEspelho, "2026-06")).toEqual([]);
    expect(despesaPorCategoriaRegistradaMes([], [], comEspelho, "2026-07")).toEqual([
      { categoria: "Veículo", valor: 8000, pct: 100 },
    ]);
  });
});
