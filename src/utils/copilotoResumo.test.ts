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

const despesa = (
  valor: number,
  categoria: string,
  data = "2026-07-05",
  descricao = "Compra no Continente da Rua Y",
): DespesaCorrente => ({
  id: `d-${categoria}-${data}`,
  data,
  valor,
  descricao,
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

  test("NÃO leva conta, cartão nem id de nenhum lançamento", () => {
    const cru = JSON.stringify(
      montarResumoParaIA(ctx({ receitas: [receita(200000)], despesas: [despesa(50000, "Casa")] })),
    );

    expect(cru).not.toContain("Visa");
    expect(cru).not.toContain("4321");
    expect(cru).not.toContain("d-Casa");
    // A data vai curta ('05/07'), nunca a ISO completa.
    expect(cru).not.toContain("2026-07-05");
    // Nem a descrição da receita: as transações que saem são só despesas.
    expect(cru).not.toContain("Salário");
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
    expect(r.ultimasTransacoes).toEqual([]);
    expect(r.tendencias).toEqual([]);
    expect(r.mediaDiaria).toBe("€ 0,00");
    expect(r.comparacaoMesAnterior.variacaoDespesas).toBeNull();
  });

  test("segue a moeda da conta", () => {
    const r = montarResumoParaIA(
      ctx({ receitas: [receita(200000)], cfg: { ...CONFIG_PADRAO, currency: "BRL" } }),
    );

    expect(r.receitas).toContain("R$");
  });

  // Bug: a camada 1 já ancora no mês do seletor do header (ver
  // `interpretarReferencia`/commit "Copiloto responde sobre o mês que está no
  // ecrã"), mas o resumo que vai para a camada 2 continuava preso a
  // `mesReal` — com o Início em julho e hoje em agosto, a IA recebia os
  // números de agosto para responder sobre "este mês".
  test("fala do mês visível, não do mês real, quando o Início navegou", () => {
    const r = montarResumoParaIA(
      ctx({
        mesReal: "2026-08",
        mesVisivel: "2026-07",
        diaDeHoje: 15,
        receitas: [receita(200000)],
        despesas: [despesa(50000, "Casa")],
      }),
    );

    expect(r.mes).toMatch(/julho/i);
    expect(r.receitas).toBe("€ 2.000,00");
    // Sem mês visível a média/projeção do mês em curso continuam a existir;
    // navegado para outro mês, misturar o dia de hoje com a despesa de um mês
    // que não é o real deixa de fazer sentido.
    expect(r.mediaDiaria).toBe("€ 0,00");
    expect(r.projecaoFimMes).toBeNull();
  });

  test("sem mês visível continua ancorado no mês real, como antes", () => {
    const r = montarResumoParaIA(ctx({ receitas: [receita(200000)] }));

    expect(r.mes).toMatch(/julho/i);
  });
});

// A janela de lançamentos crus é a única parte do resumo que atravessa a
// fronteira com dados de linha. Os limites dela são o teste.
describe("montarResumoParaIA — últimas transações", () => {
  test("leva as despesas mais recentes do mês, da nova para a antiga", () => {
    const r = montarResumoParaIA(
      ctx({
        despesas: [
          despesa(1000, "Casa", "2026-07-02", "Renda"),
          despesa(2000, "Lazer", "2026-07-11", "Cinema"),
          despesa(3000, "Comida", "2026-07-07", "Almoço"),
        ],
      }),
    );

    expect(r.ultimasTransacoes.map((t) => t.descricao)).toEqual(["Cinema", "Almoço", "Renda"]);
    expect(r.ultimasTransacoes[0]).toEqual({
      data: "11/07",
      categoria: "Lazer",
      descricao: "Cinema",
      valor: "€ 20,00",
    });
  });

  test("não leva despesas de outros meses — a janela é só o mês corrente", () => {
    const r = montarResumoParaIA(
      ctx({
        despesas: [
          despesa(1000, "Casa", "2026-06-30", "Mês passado"),
          despesa(2000, "Casa", "2026-08-01", "Mês seguinte"),
          despesa(3000, "Casa", "2026-07-03", "Este mês"),
        ],
      }),
    );

    expect(r.ultimasTransacoes.map((t) => t.descricao)).toEqual(["Este mês"]);
  });

  test("corta em 8 — o resumo não vira extrato", () => {
    const muitas = Array.from({ length: 20 }, (_, i) =>
      despesa(1000, "Casa", `2026-07-${String(i + 1).padStart(2, "0")}`, `Compra ${i + 1}`),
    );

    const r = montarResumoParaIA(ctx({ despesas: muitas }));

    expect(r.ultimasTransacoes).toHaveLength(8);
    expect(r.ultimasTransacoes[0].descricao).toBe("Compra 20");
  });
});

// Números derivados: existem porque a IA está proibida de fazer contas. Se
// não forem calculados aqui, ninguém os calcula.
describe("montarResumoParaIA — números derivados", () => {
  test("média diária divide a despesa do mês pelos dias já corridos", () => {
    const r = montarResumoParaIA(ctx({ despesas: [despesa(30000, "Casa")], diaDeHoje: 10 }));

    expect(r.mediaDiaria).toBe("€ 30,00");
  });

  test("projeção estende o saldo actual até ao último dia do mês", () => {
    // Saldo de € 1.500,00 ao dia 15 de um mês de 31 dias → € 3.100,00.
    const r = montarResumoParaIA(
      ctx({ receitas: [receita(200000)], despesas: [despesa(50000, "Casa")] }),
    );

    expect(r.projecaoFimMes).toBe("€ 3.100,00");
  });

  test("sem dia de hoje válido não há projeção nem média inventada", () => {
    const r = montarResumoParaIA(ctx({ despesas: [despesa(50000, "Casa")], diaDeHoje: 0 }));

    expect(r.projecaoFimMes).toBeNull();
    expect(r.mediaDiaria).toBe("€ 0,00");
  });

  test("compara com o mês anterior e leva a variação já com sinal", () => {
    const r = montarResumoParaIA(
      ctx({
        receitas: [receita(200000), { ...receita(100000), id: "r2", data: "2026-06-01" }],
        despesas: [despesa(50000, "Casa"), despesa(40000, "Casa", "2026-06-10")],
      }),
    );

    expect(r.comparacaoMesAnterior.mes).toMatch(/junho/i);
    expect(r.comparacaoMesAnterior.receitas).toBe("€ 1.000,00");
    expect(r.comparacaoMesAnterior.despesas).toBe("€ 400,00");
    expect(r.comparacaoMesAnterior.variacaoReceitas).toBe("+100%");
    expect(r.comparacaoMesAnterior.variacaoDespesas).toBe("+25%");
  });

  test("leva as categorias acima do costume, com desvio e meses da média", () => {
    const r = montarResumoParaIA(
      ctx({
        despesas: [
          despesa(10000, "Comida", "2026-04-10"),
          despesa(10000, "Comida", "2026-05-10"),
          despesa(10000, "Comida", "2026-06-10"),
          despesa(20000, "Comida", "2026-07-10"),
        ],
      }),
    );

    expect(r.tendencias).toEqual([{ categoria: "Comida", desvioPct: "+100%", mesesUsados: 3 }]);
  });

  test("categoria sem histórico suficiente não vira tendência", () => {
    const r = montarResumoParaIA(
      ctx({
        despesas: [despesa(10000, "Comida", "2026-06-10"), despesa(90000, "Comida", "2026-07-10")],
      }),
    );

    expect(r.tendencias).toEqual([]);
  });
});
