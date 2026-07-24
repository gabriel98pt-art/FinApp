import { describe, expect, test } from "vitest";
import type { ConfigConta, DespesaCorrente, Parcela, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import {
  encontrarNaLista,
  interpretarReferencia,
  normalizarPergunta,
  responderPergunta,
  type ContextoCopiloto,
} from "./copiloto";

function ctx(extra: Partial<ContextoCopiloto> = {}): ContextoCopiloto {
  return {
    receitas: [],
    despesas: [],
    parcelas: [],
    veiculo: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
    eventos: [],
    cfg: CONFIG_PADRAO,
    mesReal: "2026-07",
    diaDeHoje: 23,
    ...extra,
  };
}

const cfgCom = (extra: Partial<ConfigConta>): ConfigConta => ({ ...CONFIG_PADRAO, ...extra });

describe("normalizarPergunta / encontrarNaLista", () => {
  test("remove acentos", () => {
    expect(normalizarPergunta("Quanto gastei em Alimentação?")).toBe(
      "quanto gastei em alimentacao?",
    );
  });

  test("casa por palavra inteira — nome curto não bate como substring", () => {
    // "AB" não deve bater dentro de "abacate"
    expect(encontrarNaLista("comprei abacate", ["AB"], 2)).toBeNull();
    // mas bate como palavra isolada
    expect(encontrarNaLista("quanto gastei no ab este mes", ["AB"], 2)).toBe("AB");
  });

  test("nome com anotação entre parênteses casa pela versão limpa", () => {
    expect(encontrarNaLista("quanto no ab este mes", ["AB (D)"], 5)).toBe("AB (D)");
  });

  test("nomes de 2 cartões parecidos não se confundem", () => {
    const lista = ["AB Gold (C)", "AB Débito (D)"];
    expect(encontrarNaLista("gastei no gold", lista)).toBe("AB Gold (C)");
  });
});

describe("interpretarReferencia", () => {
  test("mês passado / este mês", () => {
    expect(interpretarReferencia("quanto gastei o mes passado", "2026-07").ym).toBe("2026-06");
    expect(interpretarReferencia("resumo deste mes", "2026-07").ym).toBe("2026-07");
  });

  test("nome de mês por extenso ou abreviado, sem ano, some pro ano anterior se for futuro", () => {
    expect(interpretarReferencia("quanto gastei em marco", "2026-07").ym).toBe("2026-03");
    // dezembro ainda não chegou em julho/2026 → assume o dezembro do ano anterior
    expect(interpretarReferencia("quanto gastei em dezembro", "2026-07").ym).toBe("2025-12");
  });

  test("ano explícito com nome de mês", () => {
    expect(interpretarReferencia("saldo de marco de 2025", "2026-07").ym).toBe("2025-03");
  });

  test("'ano' e 'resume o ano' pedem o ano inteiro, não só o mês corrente", () => {
    expect(interpretarReferencia("resume o ano", "2026-07").isYear).toBe(true);
    expect(interpretarReferencia("como está o ano passado", "2026-07")).toMatchObject({
      isYear: true,
      year: 2025,
    });
  });

  test("sem pista nenhuma cai no mês corrente", () => {
    expect(interpretarReferencia("oi", "2026-07").ym).toBe("2026-07");
  });
});

describe("responderPergunta — intents (seção 3.9)", () => {
  const despesas: DespesaCorrente[] = [
    {
      id: "d1",
      descricao: "Continente",
      valor: 15000,
      data: "2026-07-05",
      categoria: "Alimentação",
    },
    { id: "d2", descricao: "Ginásio", valor: 3000, data: "2026-07-10", categoria: "Lazer" },
  ];
  const receitas: Receita[] = [
    { id: "r1", descricao: "Salário", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
  ];

  test("categoria de despesa específica com percentual", () => {
    const resp = responderPergunta("quanto gastei em alimentação?", ctx({ despesas, receitas }));
    expect(resp).toContain("150,00");
    expect(resp).toMatch(/8\d%/); // 15000/18000 ≈ 83%
  });

  test("orçamento: dentro de todas as categorias", () => {
    const resp = responderPergunta(
      "estou dentro do orçamento?",
      ctx({ despesas, cfg: cfgCom({ orcamentos: { Alimentação: 20000 } }) }),
    );
    expect(resp).toMatch(/dentro do orçamento/i);
  });

  test("orçamento: estourado numa categoria", () => {
    const resp = responderPergunta(
      "orçamento deste mês",
      ctx({ despesas, cfg: cfgCom({ orcamentos: { Alimentação: 10000 } }) }),
    );
    expect(resp).toMatch(/ultrapass/i);
    expect(resp).toContain("Alimentação");
  });

  test("poupança/meta com projeção no ritmo atual", () => {
    const resp = responderPergunta(
      "vou bater a meta de poupança no ritmo atual?",
      ctx({ despesas, receitas, cfg: cfgCom({ metaPoupanca: 100000 }) }),
    );
    expect(resp).toMatch(/meta de poupança/i);
    expect(resp).toMatch(/projec/i);
  });

  test("parcela específica por nome (mesmo sem a palavra 'parcela' na pergunta)", () => {
    const parcela: Parcela = {
      id: "p1",
      descricao: "TV Nova",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      pagoPorMes: { "2026-06": true },
    };
    const resp = responderPergunta("quanto falta pagar da tv nova", ctx({ parcelas: [parcela] }));
    expect(resp).toContain("TV Nova");
    expect(resp).toMatch(/2/); // 2 parcelas restantes
  });

  test("resumo do ano soma todos os meses, não só o mês corrente", () => {
    const receitasAno: Receita[] = [
      { id: "r1", descricao: "Sal jan", valor: 100000, data: "2026-01-01", fonte: "Trabalho" },
      { id: "r2", descricao: "Sal jul", valor: 200000, data: "2026-07-01", fonte: "Trabalho" },
    ];
    const resp = responderPergunta("resume o ano", ctx({ receitas: receitasAno }));
    expect(resp).toContain("3.000,00"); // 100000+200000 cents = 3.000,00
  });

  test("saldo do mês (fallback genérico funciona sem palavra-chave específica)", () => {
    const resp = responderPergunta("qual o saldo?", ctx({ despesas, receitas }));
    expect(resp).toMatch(/saldo/i);
    expect(resp).toContain("1.820,00"); // 2000-180 = 1820,00
  });

  test("pergunta sem nenhum intent reconhecido cai na resposta padrão", () => {
    const resp = responderPergunta("qual é a capital da frança", ctx());
    expect(resp).toMatch(/Ainda não sei responder/);
  });

  test("veículo: carregamento do mês com dados reais (não mais 'sem dados')", () => {
    const resp = responderPergunta(
      "quanto gastei de carregamento este mes?",
      ctx({
        veiculo: {
          cargas: [
            { id: "c1", data: "2026-07-10", kwh: 40, precoKwh: 25, custo: 1000, local: "Casa" },
          ],
          despesas: [],
          despesasFixas: [],
          quilometragem: [],
        },
      }),
    );
    expect(resp).toContain("10,00");
    expect(resp).not.toMatch(/marco futuro/);
  });

  test("saldo do mês inclui o gasto do veículo", () => {
    const resp = responderPergunta(
      "qual o saldo?",
      ctx({
        receitas,
        despesas: [],
        veiculo: {
          cargas: [
            { id: "c1", data: "2026-07-10", kwh: 40, precoKwh: 25, custo: 50000, local: "Casa" },
          ],
          despesas: [],
          despesasFixas: [],
          quilometragem: [],
        },
      }),
    );
    // receitas 2000,00 − veículo 500,00 = 1500,00
    expect(resp).toContain("1.500,00");
  });

  test("calendário: próximos 7 dias com evento real", () => {
    const resp = responderPergunta(
      "o que tenho agendado",
      ctx({
        eventos: [{ id: "e1", titulo: "Dentista", data: "2026-07-25" }],
        mesReal: "2026-07",
        diaDeHoje: 20,
      }),
    );
    expect(resp).toContain("Dentista");
    expect(resp).not.toMatch(/marco futuro/);
  });

  test("calendário: sem eventos na janela responde honestamente", () => {
    const resp = responderPergunta("proximos eventos", ctx());
    expect(resp).toMatch(/Não há eventos agendados/);
  });

  test("moeda segue a configuração da conta, não fica fixa em EUR", () => {
    const resp = responderPergunta(
      "qual o saldo?",
      ctx({ receitas, despesas: [], cfg: cfgCom({ currency: "BRL" }) }),
    );
    expect(resp).toContain("R$");
  });
});
