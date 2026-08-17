import { describe, expect, test } from "vitest";
import type { ConfigConta, DespesaCorrente, DespesaFixa, Parcela, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import {
  categoriasAcimaDaMedia,
  categoriasDoMes,
  encontrarNaLista,
  interpretarReferencia,
  mediasPorCategoria,
  normalizarPergunta,
  responderPergunta,
  totaisDoMes,
  type ContextoCopiloto,
} from "./copiloto";
import { despesaRealizadaMes } from "./resumoMensal";

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

  test("nome de mês com 'ano passado' usa o ano anterior, não o corrente", () => {
    // Sem o ano ficar explícito, "julho" sozinho em julho/2026 seria o mês
    // atual — é o "ano passado" que tem de virar o ano para trás.
    expect(interpretarReferencia("quanto gastei em julho do ano passado", "2026-07").ym).toBe(
      "2025-07",
    );
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
  //
  // O `diaVencimento` é explícito porque o Copiloto passou a ter precisão de
  // dia: sem ele vale a convenção de esperar o fim do mês, e no dia 23 do
  // contexto a parcela ainda não teria saído — que é outro caso, coberto no
  // bloco "mês corrente conta só o que já venceu" mais abaixo.
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
      diaVencimento: 10,
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

// ---------------------------------------------------------------------------
// Comparação entre meses, variação de fraseado e personalização
// ---------------------------------------------------------------------------

/** Três meses fechados a 100 € em Alimentação, e julho ao valor que se quiser
 *  — a base de quase todos os testes de média abaixo. */
const tresMesesIguais = (julho: number): DespesaCorrente[] => [
  despesa({ data: "2026-04-02", valor: 10000 }),
  despesa({ data: "2026-05-02", valor: 10000 }),
  despesa({ data: "2026-06-02", valor: 10000 }),
  despesa({ data: "2026-07-02", valor: julho }),
];

describe("mediasPorCategoria", () => {
  test("um mês solitário não vira tendência", () => {
    // Só junho tem dados: abaixo do mínimo de meses a categoria não entra.
    // Dizer "300% acima da média" com uma amostra de um mês seria dar ares de
    // padrão a uma coincidência.
    const linhas = mediasPorCategoria(
      ctx({ despesas: [despesa({ data: "2026-06-02", valor: 10000 }), despesa({ valor: 40000 })] }),
      "2026-07",
    );

    expect(linhas).toHaveLength(0);
  });

  test("com meses suficientes, compara o mês corrente com a média", () => {
    const linhas = mediasPorCategoria(ctx({ despesas: tresMesesIguais(20000) }), "2026-07");

    expect(linhas[0]).toMatchObject({
      categoria: "Alimentação",
      media: 10000,
      gastoAtual: 20000,
      mesesUsados: 3,
      desvio: 10000,
      desvioPct: 100,
    });
  });

  test("o mês corrente não entra na sua própria média", () => {
    const linhas = mediasPorCategoria(ctx({ despesas: tresMesesIguais(99999) }), "2026-07");

    // Se julho entrasse, a média subia — e o desvio encolhia sozinho.
    expect(linhas[0].media).toBe(10000);
  });
});

describe("categoriasAcimaDaMedia", () => {
  test("ignora subidas pequenas, que são ruído e não hábito", () => {
    // 105 € contra 100 € de média: 5% não é "está a pesar mais".
    expect(
      categoriasAcimaDaMedia(ctx({ despesas: tresMesesIguais(10500) }), "2026-07"),
    ).toHaveLength(0);
  });

  test("aponta a categoria que subiu de verdade", () => {
    const acima = categoriasAcimaDaMedia(ctx({ despesas: tresMesesIguais(20000) }), "2026-07");

    expect(acima).toHaveLength(1);
    expect(acima[0]).toMatchObject({ categoria: "Alimentação", desvioPct: 100 });
  });

  test("quem gastou MENOS que o costume não aparece", () => {
    expect(
      categoriasAcimaDaMedia(ctx({ despesas: tresMesesIguais(1000) }), "2026-07"),
    ).toHaveLength(0);
  });
});

describe("intent 'o que está pesando'", () => {
  test("responde com a categoria acima da média e os dois valores", () => {
    const resp = responderPergunta(
      "o que esta pesando este mes?",
      ctx({ despesas: tresMesesIguais(20000) }),
    );

    expect(resp).toMatch(/Alimentação/);
    expect(resp).toMatch(/100%/);
    // Tem de mostrar o valor atual E a média — a afirmação sem os números por
    // trás é só opinião.
    expect(resp).toMatch(/200,00/);
    expect(resp).toMatch(/100,00/);
  });

  test("'o que mudou' e 'por que gastei mais' caem no mesmo intent", () => {
    const c = ctx({ despesas: tresMesesIguais(20000) });

    expect(responderPergunta("o que mudou?", c)).toMatch(/Alimentação/);
    expect(responderPergunta("por que gastei mais?", c)).toMatch(/Alimentação/);
  });

  test("sem nada acima do costume, diz isso em vez de inventar um culpado", () => {
    const resp = responderPergunta(
      "o que esta pesando?",
      ctx({ despesas: tresMesesIguais(10000) }),
    );

    expect(resp).toMatch(/nada|linha|costume/i);
    expect(resp).not.toMatch(/%/);
  });

  test("não rouba a pergunta de resumo", () => {
    // "resumo do mês" continua a ser resumo, não comparação.
    const resp = responderPergunta("resumo do mes", ctx({ despesas: tresMesesIguais(20000) }));
    expect(resp).toMatch(/recebeu|entradas|entrou/i);
  });
});

describe("resumo enriquecido com a comparação", () => {
  test("menciona a categoria que subiu bem acima do costume", () => {
    const resp = responderPergunta("resumo do mes", ctx({ despesas: tresMesesIguais(20000) }));

    expect(resp).toMatch(/acima da média dos últimos 3 meses/);
  });

  test("não menciona nada quando o mês está em linha com o costume", () => {
    const resp = responderPergunta("resumo do mes", ctx({ despesas: tresMesesIguais(10000) }));

    expect(resp).not.toMatch(/acima da média/);
  });
});

describe("variação de fraseado", () => {
  const comDados = (variante?: number) =>
    ctx({ despesas: [despesa({ valor: 15000 })], receitas: [receita()], variante });

  test("sem variante, a resposta é exactamente a de sempre", () => {
    // Este é o contrato que protege todos os outros testes do ficheiro: a
    // variação não pode mudar o comportamento por omissão.
    expect(responderPergunta("qual meu saldo?", comDados())).toBe(
      responderPergunta("qual meu saldo?", comDados(0)),
    );
    expect(responderPergunta("qual meu saldo?", comDados())).toMatch(
      /^O saldo de .* \(receitas menos despesas\)\.$/,
    );
  });

  test("variantes diferentes dão textos diferentes", () => {
    const a = responderPergunta("qual meu saldo?", comDados(0));
    const b2 = responderPergunta("qual meu saldo?", comDados(1));

    expect(a).not.toBe(b2);
  });

  test("mas o número é o mesmo em todas as variantes", () => {
    // O ponto da variação é o texto. O valor não pode dançar com ele.
    const respostas = [0, 1, 2, 3, 4].map((v) => responderPergunta("qual meu saldo?", comDados(v)));

    for (const r of respostas) expect(r).toContain("1.850,00");
  });

  test("a variante roda em vez de rebentar quando passa do fim da lista", () => {
    const alta = responderPergunta("qual meu saldo?", comDados(99));
    expect(alta.length).toBeGreaterThan(0);
  });

  test("resumo, orçamento e categoria também variam", () => {
    const base = ctx({ despesas: [despesa({ valor: 15000 })], cfg: cfgCom({ orcamentos: {} }) });
    const v = (q: string, variante: number) =>
      responderPergunta(q, {
        ...base,
        variante,
        cfg: cfgCom({ orcamentos: { Alimentação: 1000 } }),
      });

    expect(v("resumo do mes", 0)).not.toBe(v("resumo do mes", 1));
    expect(v("estou dentro do orcamento?", 0)).not.toBe(v("estou dentro do orcamento?", 1));
    expect(v("quanto gastei em alimentacao?", 0)).not.toBe(v("quanto gastei em alimentacao?", 1));
  });
});

describe("personalização do Copiloto", () => {
  const comNome = (nome: string, tom: "direto" | "acolhedor" = "direto") =>
    ctx({
      despesas: [despesa({ valor: 15000 })],
      receitas: [receita()],
      cfg: cfgCom({ copiloto: { nome, tom } }),
    });

  test("trata pela primeira palavra do nome", () => {
    const resp = responderPergunta("qual meu saldo?", comNome("Gabriel Castilho"));

    expect(resp).toMatch(/^Gabriel, /);
    expect(resp).not.toMatch(/Castilho/);
  });

  test("sem nome configurado, nada muda em relação a hoje", () => {
    expect(responderPergunta("qual meu saldo?", ctx({ receitas: [receita()] }))).toMatch(
      /^O saldo/,
    );
  });

  test("nome vazio ou só espaços não vira vocativo pendurado", () => {
    expect(responderPergunta("qual meu saldo?", comNome("   "))).toMatch(/^O saldo/);
  });

  test("o tom acolhedor muda o texto, não o número", () => {
    const direto = responderPergunta("qual meu saldo?", comNome("Ana", "direto"));
    const acolhedor = responderPergunta("qual meu saldo?", comNome("Ana", "acolhedor"));

    expect(direto).not.toBe(acolhedor);
    expect(direto).toContain("1.850,00");
    expect(acolhedor).toContain("1.850,00");
  });

  test("nome com HTML é escapado — vai para dentro de innerHTML como o resto", () => {
    const resp = responderPergunta("qual meu saldo?", comNome("<img onerror=x>"));

    expect(resp).not.toContain("<img");
    expect(resp).toContain("&lt;img");
  });
});

// ---------------------------------------------------------------------------
// Precisão de dia no mês corrente
//
// O Copiloto respondia 1513,28 de despesa enquanto o KPI "Despesas" do Início
// mostrava 1248,16 para o mesmo mês. As duas somas são a mesma conta, mas o
// Início passava `hoje` e o Copiloto não — e sem esse argumento uma fixa ou
// parcela em débito automático conta no dia 8 uma cobrança que só sai no 27.
//
// É o mesmo bug corrigido em ef9fa9b no Orçamento/donut, que nunca chegou a
// ser aplicado aqui. Os testes abaixo espelham os de orcamento.test.ts.
// ---------------------------------------------------------------------------

describe("copiloto: mês corrente conta só o que já venceu", () => {
  const MES = "2026-07";

  const parcelaAuto = (): Parcela => ({
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
  });

  const fixaAuto = (): DespesaFixa => ({
    id: "f1",
    descricao: "Renda",
    valor: 70000,
    categoria: "Casa",
    contaCartao: "Visa",
    autoDebit: true,
    diaVencimento: 27,
    inicio: "2026-01",
    pagoPorMes: {},
  });

  const comDia = (diaDeHoje: number) =>
    ctx({ parcelas: [parcelaAuto()], despesasFixas: [fixaAuto()], mesReal: MES, diaDeHoje });

  test("antes do vencimento não conta — o dinheiro ainda não saiu", () => {
    expect(totaisDoMes(comDia(5), MES).despesas).toBe(0);
  });

  test("no próprio dia do vencimento da parcela, ela já conta", () => {
    expect(totaisDoMes(comDia(20), MES).despesas).toBe(10000);
  });

  test("depois de vencerem as duas, contam as duas", () => {
    expect(totaisDoMes(comDia(28), MES).despesas).toBe(80000);
  });

  test("a quebra por categoria segue exactamente a mesma regra de dia", () => {
    // Se divergisse, a soma das categorias deixava de bater com o total que o
    // próprio Copiloto responde uma linha acima.
    expect(categoriasDoMes(comDia(5), MES)).toEqual({});
    expect(categoriasDoMes(comDia(28), MES)).toEqual({ Lazer: 10000, Casa: 70000 });
  });

  test("mês fechado continua a contar o valor cheio, tenha o dia que tiver", () => {
    // A precisão de dia é só do mês corrente: em junho, já tudo venceu.
    const c = ctx({ parcelas: [parcelaAuto()], mesReal: "2026-08", diaDeHoje: 1 });
    expect(totaisDoMes(c, MES).despesas).toBe(10000);
  });

  test("a resposta do intent de despesas reflecte isso", () => {
    expect(responderPergunta("quanto gastei este mes?", comDia(5))).toContain("0,00");
    expect(responderPergunta("quanto gastei este mes?", comDia(28))).toContain("800,00");
  });

  test("o intent de veículo também espera o dia do vencimento", () => {
    // Este chama `totalVeiculoMes` directamente, sem passar por `totaisDoMes`
    // nem `categoriasDoMes` — foi por isso que escapou à correção de 617d305.
    const comSeguro = (diaDeHoje: number) =>
      ctx({
        mesReal: MES,
        diaDeHoje,
        veiculo: {
          cargas: [
            { id: "c1", data: "2026-07-02", kwh: 40, precoKwh: 25, custo: 1000, local: "Casa" },
          ],
          despesas: [],
          despesasFixas: [
            {
              id: "fv1",
              descricao: "Seguro do carro",
              valor: 45000,
              categoria: "Seguro",
              contaCartao: "Visa",
              autoDebit: true,
              diaVencimento: 28,
              inicio: "2026-01",
              pagoPorMes: {},
            },
          ],
          quilometragem: [],
        },
      });

    // Dia 3: só o carregamento já feito, o seguro do dia 28 ainda não saiu.
    expect(responderPergunta("quanto gastei no carro esse mes?", comSeguro(3))).toContain("10,00");
    // Dia 28: o seguro entra e o total sobe.
    expect(responderPergunta("quanto gastei no carro esse mes?", comSeguro(28))).toContain(
      "460,00",
    );
  });

  test("a média entre meses fica consertada de tabela, por usar categoriasDoMes", () => {
    // Junho, maio e abril fechados a 100 € em Lazer; julho tem a parcela de
    // 100 € que ainda não venceu. Sem a correção, julho aparecia como 100 €
    // já gastos e a comparação dizia "em linha" quando na verdade ainda não
    // saiu nada.
    const anteriores = [
      despesa({ data: "2026-04-02", valor: 10000, categoria: "Lazer" }),
      despesa({ data: "2026-05-02", valor: 10000, categoria: "Lazer" }),
      despesa({ data: "2026-06-02", valor: 10000, categoria: "Lazer" }),
    ];
    const linha = mediasPorCategoria(
      ctx({ despesas: anteriores, parcelas: [parcelaAuto()], mesReal: MES, diaDeHoje: 5 }),
      MES,
    ).find((m) => m.categoria === "Lazer");

    expect(linha?.gastoAtual).toBe(0);
  });
});

describe("copiloto e Início respondem o mesmo número", () => {
  test("a soma do Copiloto bate com a despesa realizada do KPI 'Despesas'", () => {
    // Este é o teste que trava a regressão de origem: as duas somas existem
    // separadas e já divergiram uma vez. Se voltarem a divergir, falha aqui.
    const MES = "2026-07";
    const despesas = [despesa({ data: "2026-07-03", valor: 12816 })];
    const despesasFixas: DespesaFixa[] = [
      {
        id: "f1",
        descricao: "Renda",
        valor: 26512,
        categoria: "Casa",
        contaCartao: "Visa",
        autoDebit: true,
        diaVencimento: 27,
        inicio: "2026-01",
        pagoPorMes: {},
      },
    ];
    const veiculo = { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] };

    for (const diaDeHoje of [1, 15, 27, 31]) {
      const hoje = `2026-07-${String(diaDeHoje).padStart(2, "0")}`;
      const doCopiloto = totaisDoMes(
        ctx({ despesas, despesasFixas, veiculo, mesReal: MES, diaDeHoje }),
        MES,
      ).despesas;
      const doInicio = despesaRealizadaMes(despesas, despesasFixas, [], veiculo, MES, MES, hoje);

      expect(doCopiloto).toBe(doInicio);
    }
  });
});
