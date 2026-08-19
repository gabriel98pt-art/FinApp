import { describe, expect, it } from "vitest";
import { VEICULO_VAZIO } from "../services/veiculoService";
import type { DespesaCorrente, Parcela } from "../types";
import {
  entraDinheiro,
  filtrarTransacoes,
  passaFiltroCategoria,
  passaFiltroConta,
  transacoesDoMes,
  type DadosTransacoes,
  type Transacao,
} from "./transacoes";

const vazio: DadosTransacoes = {
  receitas: [],
  despesasCorrentes: [],
  despesasFixas: [],
  parcelas: [],
  transferencias: [],
  veiculo: VEICULO_VAZIO,
};

describe("transacoesDoMes", () => {
  it("junta os domínios e ordena da mais recente para a mais antiga", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        receitas: [
          { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-05", fonte: "Salário" },
        ],
        despesasCorrentes: [
          {
            id: "d1",
            descricao: "Mercado",
            valor: 8000,
            data: "2026-07-20",
            categoria: "Alimentação",
          },
        ],
        veiculo: {
          ...VEICULO_VAZIO,
          cargas: [
            {
              id: "c1",
              data: "2026-07-12",
              kwh: 30,
              precoKwh: 20,
              custo: 600,
              local: "Galp",
            },
          ],
        },
      },
      "2026-07",
    );
    expect(t.map((x) => x.chave)).toEqual(["despesa-d1", "carga-c1", "receita-r1"]);
    expect(t[2].entrada).toBe(true);
    expect(t[0].entrada).toBe(false);
  });

  it("no mesmo dia, intercala pela ordem real de entrada — não agrupa por tipo", () => {
    // O bug relatado: o desempate comparava a `chave` inteira ("despesa-x",
    // "fixa-x", "parcela-x"), e o prefixo do tipo dominava o localeCompare —
    // um dia com despesa, parcela e fixa misturadas saía sempre com todas as
    // despesas juntas, depois as fixas, depois as parcelas, nunca na ordem em
    // que realmente aconteceram.
    const t = transacoesDoMes(
      {
        ...vazio,
        despesasCorrentes: [
          {
            id: "b-despesa",
            descricao: "Café",
            valor: 500,
            data: "2026-08-10",
            categoria: "Alimentação",
          },
          // A despesa espelho que o pagamento da parcela gerou — fica fora do
          // feed pelo seu próprio lado (origem 'parc'), mas empresta o `id`
          // (a push key, criada ANTES da despesa acima) pra ordenar a parcela.
          {
            id: "a-parcela-real",
            descricao: "Sofá",
            valor: 10000,
            data: "2026-08-10",
            categoria: "Parcelas",
            origem: "parc",
            parcelaId: "p1",
            parcelaMes: "2026-08",
          },
        ],
        parcelas: [
          {
            id: "p1",
            descricao: "Sofá",
            total: 30000,
            numParcelas: 3,
            primeiroMes: "2026-08",
            categoria: "Casa",
            diaVencimento: 10,
            pagoPorMes: { "2026-08": true },
          },
        ],
        despesasFixas: [
          {
            id: "c-fixa",
            descricao: "Internet",
            valor: 4000,
            categoria: "Casa",
            diaVencimento: 10,
            pagoPorMes: { "2026-08": true },
          },
        ],
      },
      "2026-08",
    );
    expect(t.map((x) => x.origem)).toEqual(["parcela", "despesa", "fixa"]);
    expect(t.map((x) => x.ordemId)).toEqual(["a-parcela-real", "b-despesa", "c-fixa"]);
  });

  it("ignora o que é de outro mês", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        receitas: [
          { id: "r1", descricao: "Junho", valor: 100, data: "2026-06-30", fonte: "Extra" },
        ],
      },
      "2026-07",
    );
    expect(t).toHaveLength(0);
  });

  it("não duplica a parcela: a despesa gerada por ela fica de fora", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        parcelas: [
          {
            id: "p1",
            descricao: "Sofá",
            total: 30000,
            numParcelas: 3,
            primeiroMes: "2026-07",
            pagoPorMes: { "2026-07": true },
          },
        ],
        despesasCorrentes: [
          {
            id: "d1",
            descricao: "Sofá 1/3",
            valor: 10000,
            data: "2026-07-10",
            categoria: "Parcelas",
            origem: "parc",
            parcelaId: "p1",
            parcelaMes: "2026-07",
          },
        ],
      },
      "2026-07",
    );
    expect(t).toHaveLength(1);
    expect(t[0].origem).toBe("parcela");
    expect(t[0].titulo).toBe("Sofá (1/3)");
    expect(t[0].valor).toBe(10000);
  });

  it("mantém o pagamento de fatura, que é saída real da conta", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        despesasCorrentes: [
          {
            id: "d1",
            descricao: "Pagamento fatura",
            valor: 50000,
            data: "2026-07-08",
            categoria: "Outros",
            origem: "fat",
          },
        ],
      },
      "2026-07",
    );
    expect(t).toHaveLength(1);
  });

  it("tira o ajuste de reconciliação — não é uma transação real", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        despesasCorrentes: [
          {
            id: "d1",
            descricao: "Ajuste",
            valor: 500000,
            data: "2026-07-08",
            categoria: "Ajuste",
            origem: "recon",
          },
        ],
      },
      "2026-07",
    );
    expect(t).toHaveLength(0);
  });

  it("fixa só aparece no mês em que foi marcada como paga", () => {
    const fixa = {
      id: "f1",
      descricao: "Renda",
      valor: 50000,
      categoria: "Casa",
      diaVencimento: 8,
      pagoPorMes: { "2026-07": true },
    };
    expect(transacoesDoMes({ ...vazio, despesasFixas: [fixa] }, "2026-07")[0].data).toBe(
      "2026-07-08",
    );
    expect(transacoesDoMes({ ...vazio, despesasFixas: [fixa] }, "2026-08")).toHaveLength(0);
  });

  it("fixa em débito automático no cartão entra sem ninguém a marcar", () => {
    const fixa = {
      id: "f2",
      descricao: "Seguro",
      valor: 4500,
      categoria: "Seguro",
      diaVencimento: 10,
      contaCartao: "AB Gold (C)",
      autoDebit: true,
      inicio: "2026-06" as const,
      pagoPorMes: {},
    };
    const dados = { ...vazio, despesasFixas: [fixa] };
    // Com o mês de hoje: julho já saiu do cartão, mesmo sem marcação.
    expect(transacoesDoMes(dados, "2026-07", "2026-08")).toHaveLength(1);
    // Mês que ainda não chegou, e mês anterior ao início: não.
    expect(transacoesDoMes(dados, "2026-09", "2026-08")).toHaveLength(0);
    expect(transacoesDoMes(dados, "2026-05", "2026-08")).toHaveLength(0);
    // Sem o mês de hoje, nada muda em relação ao comportamento antigo.
    expect(transacoesDoMes(dados, "2026-07")).toHaveLength(0);
  });

  // Mês já fechado: mesma regra de `contribuicaoFixasMes`/`statusOrcamentoMes`
  // — conta o valor cheio, marcado ou não, senão o extrato de um mês passado
  // discordava do Orçamento e dos totais sobre a mesma fixa/parcela manual.
  it("fixa manual não marcada ainda assim entra num mês já fechado", () => {
    const fixa = {
      id: "f9",
      descricao: "Renda",
      valor: 50000,
      categoria: "Casa",
      diaVencimento: 8,
      pagoPorMes: {},
    };
    const dados = { ...vazio, despesasFixas: [fixa] };
    // Julho já fechou (estamos em agosto): conta mesmo sem marcação.
    expect(transacoesDoMes(dados, "2026-07", "2026-08")).toHaveLength(1);
    // Mês corrente: continua a exigir a marcação, como sempre.
    expect(transacoesDoMes(dados, "2026-08", "2026-08")).toHaveLength(0);
  });

  // O bug relatado: MEO vence dia 27 e aparecia no extrato já no dia 1 de
  // agosto, com data no futuro. `hoje` dá precisão de dia ao mês corrente.
  it("com `hoje`, fixa em débito automático só entra no extrato depois do dia de vencimento", () => {
    const fixa = {
      id: "f3",
      descricao: "MEO",
      valor: 1500,
      categoria: "Telemóvel",
      diaVencimento: 27,
      contaCartao: "ActivoBank",
      autoDebit: true,
      pagoPorMes: {},
    };
    const dados = { ...vazio, despesasFixas: [fixa] };
    expect(transacoesDoMes(dados, "2026-08", "2026-08", "2026-08-08")).toHaveLength(0);
    const depois = transacoesDoMes(dados, "2026-08", "2026-08", "2026-08-27");
    expect(depois).toHaveLength(1);
    expect(depois[0].data).toBe("2026-08-27");
  });

  describe("parcela: só o mês pago entra, e com a data em que se pagou mesmo", () => {
    const sofa: Parcela = {
      id: "p1",
      descricao: "Sofá",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-07",
      categoria: "Casa",
      diaVencimento: 20,
      pagoPorMes: {},
    };
    /** O lançamento que `pagarMesParcela`/`pagarFatura` criam ao pagar. */
    const lancamento = (extra: Partial<DespesaCorrente>): DespesaCorrente => ({
      id: "d1",
      descricao: "Sofá",
      valor: 10000,
      data: "2026-08-03",
      categoria: "Parcelas",
      origem: "parc",
      parcelaId: "p1",
      ...extra,
    });

    it("mês por pagar não aparece, mesmo estando no plano da parcela", () => {
      // O bug: a parcela de agosto vencia a 20 e aparecia a 20/08 no extrato,
      // estando-se a 5/08 e sem nada ter sido pago.
      const t = transacoesDoMes({ ...vazio, parcelas: [sofa] }, "2026-08");
      expect(t).toHaveLength(0);
    });

    // Mês já fechado: mesma regra da fixa manual acima — conta o valor cheio
    // do plano mesmo sem marcação, como `contribuicaoParcelasMes`/
    // `statusOrcamentoMes` já contam para esse mês.
    it("mês por pagar entra quando o mês já fechou", () => {
      const t = transacoesDoMes({ ...vazio, parcelas: [sofa] }, "2026-07", "2026-09");
      expect(t).toHaveLength(1);
      expect(t[0].valor).toBe(10000);
    });

    // Ninguém marca uma parcela em débito automático — o botão "Pagar mês" nem
    // aparece para ela. Sem o mesReferencia, ela nunca entrava no extrato,
    // mesmo já tendo saído sozinha do cartão.
    it("em débito automático entra sem marcação, dado o mês de referência", () => {
      const auto: Parcela = {
        ...sofa,
        cartao: "AB Gold (C)",
        autoDebit: true,
        pagoPorMes: {},
      };
      const t = transacoesDoMes({ ...vazio, parcelas: [auto] }, "2026-08", "2026-08");
      expect(t).toHaveLength(1);
      expect(t[0].valor).toBe(10000);
      // Sem lançamento real, cai no dia do vencimento (dado incoerente).
      expect(t[0].data).toBe("2026-08-20");
    });

    it("em débito automático, sem mesReferencia, comportamento antigo — não entra", () => {
      const auto: Parcela = {
        ...sofa,
        cartao: "AB Gold (C)",
        autoDebit: true,
        pagoPorMes: {},
      };
      const t = transacoesDoMes({ ...vazio, parcelas: [auto] }, "2026-08");
      expect(t).toHaveLength(0);
    });

    // O bug relatado: uma parcela em débito automático que vence dia 27
    // aparecia no extrato já no dia 1, com data no futuro (27/08 antes de o
    // dia chegar). `hoje` dá precisão de dia ao mês corrente.
    it("com `hoje`, débito automático só entra no extrato depois do dia de vencimento", () => {
      const auto: Parcela = {
        ...sofa,
        cartao: "AB Gold (C)",
        autoDebit: true,
        diaVencimento: 27,
        pagoPorMes: {},
      };
      const antes = transacoesDoMes(
        { ...vazio, parcelas: [auto] },
        "2026-08",
        "2026-08",
        "2026-08-08",
      );
      expect(antes).toHaveLength(0);

      const depois = transacoesDoMes(
        { ...vazio, parcelas: [auto] },
        "2026-08",
        "2026-08",
        "2026-08-27",
      );
      expect(depois).toHaveLength(1);
      expect(depois[0].data).toBe("2026-08-27");
    });

    it("mês pago usa a data do lançamento, não o dia do vencimento", () => {
      const t = transacoesDoMes(
        {
          ...vazio,
          parcelas: [{ ...sofa, pagoPorMes: { "2026-08": true } }],
          despesasCorrentes: [lancamento({ data: "2026-08-03", parcelaMes: "2026-08" })],
        },
        "2026-08",
      );
      expect(t).toHaveLength(1);
      expect(t[0].data).toBe("2026-08-03");
    });

    it("pago pela fatura do cartão também conta como pago", () => {
      // `pagarFatura` marca "fatura" em vez de true — os dois querem dizer pago.
      const t = transacoesDoMes(
        {
          ...vazio,
          parcelas: [{ ...sofa, pagoPorMes: { "2026-07": "fatura" as const } }],
          despesasCorrentes: [lancamento({ data: "2026-07-15", parcelaMes: "2026-07" })],
        },
        "2026-07",
      );
      expect(t).toHaveLength(1);
      expect(t[0].data).toBe("2026-07-15");
    });

    it("quitação antecipada: os meses varridos herdam a data do lançamento 'quit'", () => {
      const dados: DadosTransacoes = {
        ...vazio,
        parcelas: [{ ...sofa, pagoPorMes: { "2026-07": true, "2026-08": true, "2026-09": true } }],
        despesasCorrentes: [lancamento({ data: "2026-07-02", parcelaMes: "quit", valor: 30000 })],
      };
      // Um lançamento só cobre os três meses — todos ficam com a data dele.
      expect(transacoesDoMes(dados, "2026-07")[0].data).toBe("2026-07-02");
      expect(transacoesDoMes(dados, "2026-08")[0].data).toBe("2026-07-02");
      expect(transacoesDoMes(dados, "2026-09")[0].data).toBe("2026-07-02");
    });

    it("sem lançamento nenhum (dado incoerente) cai no dia do vencimento", () => {
      const t = transacoesDoMes(
        { ...vazio, parcelas: [{ ...sofa, pagoPorMes: { "2026-08": true } }] },
        "2026-08",
      );
      expect(t).toHaveLength(1);
      expect(t[0].data).toBe("2026-08-20");
    });

    it("o lançamento de OUTRA parcela não serve de data", () => {
      const t = transacoesDoMes(
        {
          ...vazio,
          parcelas: [{ ...sofa, pagoPorMes: { "2026-08": true } }],
          despesasCorrentes: [
            lancamento({ id: "d9", data: "2026-08-01", parcelaMes: "2026-08", parcelaId: "outra" }),
          ],
        },
        "2026-08",
      );
      expect(t[0].data).toBe("2026-08-20");
    });
  });

  it("leva a nota de cada domínio para o feed", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        receitas: [
          {
            id: "r1",
            descricao: "Salário",
            valor: 100,
            data: "2026-07-05",
            fonte: "Trabalho",
            nota: "com subsídio",
          },
        ],
        despesasCorrentes: [
          {
            id: "d1",
            descricao: "Compra",
            valor: 100,
            data: "2026-07-06",
            categoria: "Casa",
            nota: "torneira nova",
          },
        ],
        transferencias: [
          {
            id: "t1",
            data: "2026-07-07",
            de: "A",
            para: "B",
            valor: 100,
            nota: "poupança do mês",
          },
        ],
      },
      "2026-07",
    );
    const porOrigem = Object.fromEntries(t.map((x) => [x.origem, x.nota]));
    expect(porOrigem).toEqual({
      receita: "com subsídio",
      despesa: "torneira nova",
      transferencia: "poupança do mês",
    });
  });

  it("na despesa de veículo a nota é o próprio título — não vem repetida", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        veiculo: {
          ...VEICULO_VAZIO,
          despesas: [
            {
              id: "dv1",
              data: "2026-07-09",
              categoria: "Manutenção",
              valor: 5000,
              nota: "troca de óleo",
            },
          ],
        },
      },
      "2026-07",
    );
    expect(t[0].titulo).toBe("troca de óleo");
    expect(t[0].nota).toBeUndefined();
  });

  it("fixa sem dia de vencimento cai no dia 1, só pra ter lugar na ordem", () => {
    const t = transacoesDoMes(
      {
        ...vazio,
        despesasFixas: [
          {
            id: "f1",
            descricao: "Renda",
            valor: 50000,
            categoria: "Casa",
            pagoPorMes: { "2026-07": true },
          },
        ],
      },
      "2026-07",
    );
    expect(t[0].data).toBe("2026-07-01");
  });
});

function transacao(extra: Partial<Transacao> = {}): Transacao {
  return {
    chave: "x",
    refId: "1",
    ordemId: "1",
    origem: "despesa",
    data: "2026-07-01",
    titulo: "Item",
    valor: 1000,
    entrada: false,
    ...extra,
  };
}

describe("passaFiltroCategoria", () => {
  it("sem filtro, tudo passa", () => {
    expect(passaFiltroCategoria(transacao(), "")).toBe(true);
  });

  it("'Receita' só casa a origem receita", () => {
    expect(passaFiltroCategoria(transacao({ origem: "receita" }), "Receita")).toBe(true);
    expect(passaFiltroCategoria(transacao({ origem: "despesa" }), "Receita")).toBe(false);
  });

  it("'Transferência interna' só casa a origem transferencia", () => {
    expect(
      passaFiltroCategoria(transacao({ origem: "transferencia" }), "Transferência interna"),
    ).toBe(true);
    expect(passaFiltroCategoria(transacao({ origem: "despesa" }), "Transferência interna")).toBe(
      false,
    );
  });

  it("'Despesa' casa despesa, fixa e parcela — qualquer categoria", () => {
    for (const origem of ["despesa", "fixa", "parcela"] as const) {
      expect(passaFiltroCategoria(transacao({ origem, categoria: "Mercado" }), "Despesa")).toBe(
        true,
      );
    }
    expect(passaFiltroCategoria(transacao({ origem: "carga" }), "Despesa")).toBe(false);
    expect(passaFiltroCategoria(transacao({ origem: "receita" }), "Despesa")).toBe(false);
  });

  it("nome de categoria casa só despesa/fixa/parcela NAQUELA categoria", () => {
    expect(
      passaFiltroCategoria(transacao({ origem: "despesa", categoria: "Mercado" }), "Mercado"),
    ).toBe(true);
    expect(
      passaFiltroCategoria(transacao({ origem: "fixa", categoria: "Mercado" }), "Mercado"),
    ).toBe(true);
    expect(
      passaFiltroCategoria(transacao({ origem: "despesa", categoria: "Lazer" }), "Mercado"),
    ).toBe(false);
  });

  it("categoria de veículo (carga/despesaVeiculo) nunca casa filtro de categoria de despesa", () => {
    expect(
      passaFiltroCategoria(transacao({ origem: "carga", categoria: "Carga Elétrica" }), "Mercado"),
    ).toBe(false);
    expect(
      passaFiltroCategoria(
        transacao({ origem: "despesaVeiculo", categoria: "Manutenção" }),
        "Manutenção",
      ),
    ).toBe(false);
  });
});

describe("passaFiltroConta", () => {
  it("sem filtro, tudo passa", () => {
    expect(passaFiltroConta(transacao({ conta: "Revolut" }), "")).toBe(true);
    expect(passaFiltroConta(transacao({ conta: undefined }), "")).toBe(true);
  });

  it("com filtro, só a mesma conta passa", () => {
    expect(passaFiltroConta(transacao({ conta: "Revolut" }), "Revolut")).toBe(true);
    expect(passaFiltroConta(transacao({ conta: "Wise" }), "Revolut")).toBe(false);
    expect(passaFiltroConta(transacao({ conta: undefined }), "Revolut")).toBe(false);
  });
});

describe("filtrarTransacoes", () => {
  it("combina categoria e conta — as duas têm que passar (E lógico)", () => {
    const itens = [
      transacao({ chave: "a", origem: "despesa", categoria: "Mercado", conta: "Revolut" }),
      transacao({ chave: "b", origem: "despesa", categoria: "Mercado", conta: "Wise" }),
      transacao({ chave: "c", origem: "despesa", categoria: "Lazer", conta: "Revolut" }),
    ];
    expect(filtrarTransacoes(itens, "Mercado", "Revolut").map((t) => t.chave)).toEqual(["a"]);
    expect(filtrarTransacoes(itens, "Mercado", "").map((t) => t.chave)).toEqual(["a", "b"]);
    expect(filtrarTransacoes(itens, "", "Revolut").map((t) => t.chave)).toEqual(["a", "c"]);
    expect(filtrarTransacoes(itens, "", "")).toHaveLength(3);
  });
});

describe("entraDinheiro", () => {
  it("segue o campo `entrada` quando o valor é positivo", () => {
    expect(entraDinheiro(transacao({ valor: 1000, entrada: true }))).toBe(true);
    expect(entraDinheiro(transacao({ valor: 1000, entrada: false }))).toBe(false);
  });

  it("inverte a direção quando o valor é negativo (reembolso)", () => {
    // Reembolso: despesa de valor negativo. Dinheiro que VOLTOU, portanto
    // entrada — sem isto a linha saía com o menos duas vezes ("− € -75,00").
    expect(entraDinheiro(transacao({ valor: -7500, entrada: false }))).toBe(true);
    expect(entraDinheiro(transacao({ valor: -7500, entrada: true }))).toBe(false);
  });

  it("valor zero não inverte nada", () => {
    expect(entraDinheiro(transacao({ valor: 0, entrada: false }))).toBe(false);
    expect(entraDinheiro(transacao({ valor: 0, entrada: true }))).toBe(true);
  });
});
