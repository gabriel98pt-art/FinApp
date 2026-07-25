import { describe, expect, it } from "vitest";
import { VEICULO_VAZIO } from "../services/veiculoService";
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
            pagoPorMes: {},
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
