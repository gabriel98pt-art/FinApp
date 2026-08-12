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
    despesasFixas: [],
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

  // categoriasDoMes (uso interno do Copiloto) reimplementa a mesma soma de
  // despesaPorCategoriaMes — e tinha o mesmo furo: parcela em débito
  // automático não contava sem marcação manual.
  test("categoria específica soma a parcela em débito automático sem marcação", () => {
    const parcela: Parcela = {
      id: "p1",
      descricao: "TV Nova",
      total: 5000,
      numParcelas: 1,
      primeiroMes: "2026-07",
      categoria: "Alimentação",
      cartao: "AB Gold (C)",
      autoDebit: true,
      pagoPorMes: {},
    };
    const resp = responderPergunta(
      "quanto gastei em alimentação?",
      ctx({ despesas, receitas, parcelas: [parcela] }),
    );
    expect(resp).toContain("200,00"); // 150,00 das despesas + 50,00 da parcela
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

  // Ninguém marca uma parcela em débito automático — o botão "Pagar mês" nem
  // aparece para ela. Sem tratar isso, o Copiloto contava o mês corrente como
  // "em aberto" mesmo já tendo saído sozinho do cartão.
  test("parcela específica em débito automático não conta o mês já saído pelo cartão", () => {
    const parcela: Parcela = {
      id: "p1",
      descricao: "TV Nova",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      cartao: "AB Gold (C)",
      autoDebit: true,
      pagoPorMes: {},
    };
    // mesReal = "2026-07": junho e julho já saíram pelo cartão, só agosto falta.
    const resp = responderPergunta("quanto falta pagar da tv nova", ctx({ parcelas: [parcela] }));
    expect(resp).toContain("TV Nova");
    expect(resp).toMatch(/Faltam <b>1<\/b> parcela/);
  });

  test("parcelas agregado não conta o mês em débito automático já saído pelo cartão", () => {
    const parcela: Parcela = {
      id: "p1",
      descricao: "TV Nova",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      cartao: "AB Gold (C)",
      autoDebit: true,
      pagoPorMes: {},
    };
    const resp = responderPergunta(
      "quantas parcelas tenho em aberto",
      ctx({ parcelas: [parcela] }),
    );
    expect(resp).toMatch(/<b>1<\/b> parcela/);
  });

  test("pendentes não conta a parcela em débito automático já saída pelo cartão", () => {
    const parcela: Parcela = {
      id: "p1",
      descricao: "TV Nova",
      total: 30000,
      numParcelas: 3,
      primeiroMes: "2026-06",
      cartao: "AB Gold (C)",
      autoDebit: true,
      pagoPorMes: {},
    };
    // Julho já saiu pelo cartão (mesReal = 2026-07) — não é pendência.
    const resp = responderPergunta("o que tenho pendente?", ctx({ parcelas: [parcela] }));
    expect(resp).toMatch(/Não há pendentes/);
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

// ---------------------------------------------------------------------------
// Intenções que ficavam por exercer. O copiloto é a peça com mais decisões do
// app (48% de ramos antes disto), e cada intenção que ninguém testa é uma
// resposta que pode passar a dizer outra coisa sem nada falhar — e é uma
// resposta sobre o dinheiro de alguém.
// ---------------------------------------------------------------------------

const despesa = (extra: Partial<DespesaCorrente> = {}): DespesaCorrente =>
  ({
    id: `d${Math.random()}`,
    descricao: "Mercado",
    valor: 5000,
    data: "2026-07-10",
    categoria: "Alimentação",
    ...extra,
  }) as DespesaCorrente;

const receita = (extra: Partial<Receita> = {}): Receita =>
  ({
    id: `r${Math.random()}`,
    descricao: "Salário",
    valor: 200000,
    data: "2026-07-05",
    fonte: "Trabalho",
    ...extra,
  }) as Receita;

describe("copiloto: perguntas sem dados", () => {
  // O caso mais provável de todos na primeira semana de uso — e o mais fácil
  // de deixar rebentar, porque quase toda a resposta assume uma lista cheia.
  test.each([
    ["quanto gastei este mes", /0,00|Não há|sem/i],
    ["quanto recebi este mes", /0,00|Não há|sem/i],
    ["como estou este mes", /./],
    ["qual a minha maior categoria", /./],
    ["quanto devo no cartao", /cartõ|cartão|Ainda não|Não há/i],
    ["quais as minhas parcelas", /parcela|Ainda não|Não há/i],
    ["estou dentro do orcamento", /orçamento|Ainda não/i],
    ["quanto falta pagar", /./],
    ["qual a minha poupanca", /./],
    ["qual foi o melhor mes", /./],
    ["o que tenho na agenda", /evento|agendad/i],
    ["quanto gastei com o carro", /./],
    ["qual foi a ultima recarga", /combustível|carregamento|Ainda não/i],
    ["quanto gastei em manutencao", /./],
  ])("%s não rebenta e responde alguma coisa", (pergunta, esperado) => {
    const r = responderPergunta(pergunta, ctx());
    expect(typeof r).toBe("string");
    expect(r.length).toBeGreaterThan(0);
    expect(r).toMatch(esperado);
  });
});

describe("copiloto: cartões", () => {
  const cfg = cfgCom({
    contasCartoes: ["AB Gold (C)", "Conta (D)"],
    tipoCartao: { "AB Gold (C)": "credit", "Conta (D)": "debit" },
  });

  test("sem cartões configurados, diz isso em vez de somar zero", () => {
    const semCartoes = cfgCom({ contasCartoes: [], tipoCartao: {} });
    expect(responderPergunta("quanto gastei no cartao", ctx({ cfg: semCartoes }))).toMatch(
      /Ainda não há cartões/,
    );
  });

  test("com cartões mas sem despesas no mês, diz que não há gastos", () => {
    expect(responderPergunta("quanto gastei nos cartoes", ctx({ cfg }))).toMatch(
      /Não há despesas em nenhum cartão/,
    );
  });

  test("soma as despesas por cartão", () => {
    const r = responderPergunta(
      "quanto gastei nos cartoes este mes",
      ctx({ cfg, despesas: [despesa({ contaCartao: "AB Gold (C)", valor: 12345 })] }),
    );
    expect(r).toContain("AB Gold (C)");
  });
});

describe("copiloto: parcelas", () => {
  const parcela = (extra: Partial<Parcela> = {}): Parcela => ({
    id: "p1",
    descricao: "Portátil",
    total: 30000,
    numParcelas: 3,
    primeiroMes: "2026-06",
    pagoPorMes: {},
    ...extra,
  });

  test("sem parcelas, diz que não há", () => {
    expect(responderPergunta("quais as minhas parcelas", ctx())).toMatch(/Ainda não|Não há|não/i);
  });

  test("parcela já quitada é anunciada como tal, não como pendente", () => {
    const quitada = parcela({
      pagoPorMes: { "2026-06": true, "2026-07": true, "2026-08": true },
    });
    const r = responderPergunta(
      "quanto falta na parcela do portatil",
      ctx({ parcelas: [quitada] }),
    );
    expect(r).toMatch(/totalmente paga|quitada/i);
  });

  test("parcela em aberto diz quanto falta", () => {
    const r = responderPergunta(
      "quanto falta na parcela do portatil",
      ctx({ parcelas: [parcela()] }),
    );
    expect(r).toContain("Portátil");
  });
});

describe("copiloto: orçamento", () => {
  test("sem tectos definidos, diz isso", () => {
    expect(responderPergunta("estou dentro do orcamento", ctx())).toMatch(/Ainda não há orçamento/);
  });

  test("dentro do teto responde que está tudo bem", () => {
    const cfg = cfgCom({ orcamentos: { Alimentação: 50000 } });
    const r = responderPergunta(
      "estou dentro do orcamento",
      ctx({ cfg, despesas: [despesa({ valor: 1000 })] }),
    );
    expect(r).toMatch(/dentro|nenhum|tudo/i);
  });

  test("teto estourado nomeia a categoria", () => {
    const cfg = cfgCom({ orcamentos: { Alimentação: 1000 } });
    const r = responderPergunta(
      "estou dentro do orcamento",
      ctx({ cfg, despesas: [despesa({ valor: 90000 })] }),
    );
    expect(r).toContain("Alimentação");
  });
});

describe("copiloto: melhor e pior mês", () => {
  test("com um ano de dados, escolhe o melhor e o pior", () => {
    const c = ctx({
      receitas: [receita({ data: "2026-03-01", valor: 500000 }), receita({ data: "2026-05-01" })],
      despesas: [despesa({ data: "2026-05-10", valor: 400000 })],
    });
    expect(responderPergunta("qual foi o melhor mes", c)).toMatch(/./);
    expect(responderPergunta("qual foi o pior mes", c)).toMatch(/./);
  });
});

describe("copiloto: resumo anual", () => {
  test("resumo de um ano não conta meses ainda por acontecer", () => {
    // `mesReal` é julho: dezembro de 2026 ainda não existe e não pode entrar
    // no total, senão o ano fecha com números inventados.
    const c = ctx({ receitas: [receita({ data: "2026-03-01", valor: 100000 })] });
    const r = responderPergunta("resumo de 2026", c);
    expect(typeof r).toBe("string");
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("copiloto: pergunta que não bate em nada", () => {
  test("cai na resposta padrão em vez de ficar em branco", () => {
    const r = responderPergunta("qual a capital de portugal", ctx());
    expect(r.length).toBeGreaterThan(0);
  });

  test("pergunta vazia também tem resposta", () => {
    expect(responderPergunta("", ctx()).length).toBeGreaterThan(0);
  });
});
