// O resumo é a fronteira de privacidade do Copiloto: é literalmente o que sai
// da app em direção ao Google. Os testes aqui existem para que qualquer coisa
// nova que passe a atravessar essa fronteira tenha de ser escrita de propósito
// — e não entre de carona numa mudança de outra coisa.

import { describe, expect, test } from "vitest";
import type { ContextoCopiloto } from "./copiloto";
import type { DespesaCorrente, Fundo, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { montarResumoParaIA } from "./copilotoResumo";

function ctx(extra: Partial<ContextoCopiloto> = {}): ContextoCopiloto {
  return {
    receitas: [],
    despesas: [],
    despesasFixas: [],
    parcelas: [],
    veiculo: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
    eventos: [],
    fundos: [],
    cfg: CONFIG_PADRAO,
    mesReal: "2026-07",
    diaDeHoje: 15,
    ...extra,
  };
}

const receita = (valor: number): Receita => ({
  id: "r1",
  data: "2026-07-01",
  valor,
  descricao: "Salário da empresa X",
  fonte: "Trabalho",
});

const despesa = (valor: number, categoria: string): DespesaCorrente => ({
  id: `d-${categoria}`,
  data: "2026-07-05",
  valor,
  descricao: "Compra no Continente da Rua Y",
  categoria,
  contaCartao: "Visa terminado em 4321",
});

describe("montarResumoParaIA", () => {
  test("leva os totais do mês já formatados, não em centavos", () => {
    const r = montarResumoParaIA(
      ctx({ receitas: [receita(200000)], despesas: [despesa(50000, "Casa")] }),
    );

    // Formatado: a IA não tem de dividir nada por 100 — e não tem de acertar.
    expect(r.receitas).toBe("€ 2.000,00");
    expect(r.despesas).toBe("€ 500,00");
    expect(r.saldo).toBe("€ 1.500,00");
    expect(r.mes).toMatch(/julho/i);
  });

  test("NÃO leva descrição, data, conta nem cartão de nenhum lançamento", () => {
    const cru = JSON.stringify(
      montarResumoParaIA(ctx({ receitas: [receita(200000)], despesas: [despesa(50000, "Casa")] })),
    );

    expect(cru).not.toContain("Continente");
    expect(cru).not.toContain("Rua Y");
    expect(cru).not.toContain("Visa");
    expect(cru).not.toContain("4321");
    expect(cru).not.toContain("2026-07-05");
  });

  test("a quebra por categoria vai ordenada da maior para a menor", () => {
    const r = montarResumoParaIA(
      ctx({
        despesas: [despesa(10000, "Lazer"), despesa(90000, "Casa"), despesa(50000, "Comida")],
      }),
    );

    expect(r.categorias.map((c) => c.nome)).toEqual(["Casa", "Comida", "Lazer"]);
    expect(r.categorias[0].total).toBe("€ 900,00");
  });

  test("corta a cauda de categorias — a lista não cresce sem limite", () => {
    const muitas = Array.from({ length: 20 }, (_, i) => despesa(1000 * (i + 1), `Cat${i}`));

    expect(montarResumoParaIA(ctx({ despesas: muitas })).categorias).toHaveLength(8);
  });

  test("só vão fundos COM prazo — sem prazo não há nada a planear no tempo", () => {
    const comPrazo: Fundo = {
      id: "f1",
      nome: "Viagem",
      alvo: 200000,
      atual: 50000,
      prazo: "2026-12-31",
    };
    const semPrazo: Fundo = { id: "f2", nome: "Reserva", alvo: 500000, atual: 10000 };

    const r = montarResumoParaIA(ctx({ fundos: [comPrazo, semPrazo] }));

    expect(r.fundos).toHaveLength(1);
    expect(r.fundos[0]).toEqual({
      nome: "Viagem",
      alvo: "€ 2.000,00",
      atual: "€ 500,00",
      prazo: "2026-12-31",
    });
  });

  test("conta vazia produz um resumo válido, não rebenta", () => {
    const r = montarResumoParaIA(ctx());

    expect(r.categorias).toEqual([]);
    expect(r.fundos).toEqual([]);
    expect(r.saldo).toBe("€ 0,00");
  });

  test("segue a moeda da conta", () => {
    const r = montarResumoParaIA(
      ctx({ receitas: [receita(200000)], cfg: { ...CONFIG_PADRAO, currency: "BRL" } }),
    );

    expect(r.receitas).toContain("R$");
  });
});
