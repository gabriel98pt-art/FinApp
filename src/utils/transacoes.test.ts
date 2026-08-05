import { describe, expect, it } from "vitest";
import { VEICULO_VAZIO } from "../services/veiculoService";
import type { DespesaCorrente, Parcela } from "../types";
import { transacoesDoMes, type DadosTransacoes } from "./transacoes";

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
