import { describe, expect, test } from "vitest";
import type { CargaEletrica } from "../types";
import type { ExistenteParaDedup, LinhaExtrato, Parcela } from "../types";
import {
  analisarLinha,
  classificarLancamento,
  estimarKwh,
  normalizarDescricao,
  reconhecerCarga,
  similaridadeDescricoes,
  verificarDuplicata,
} from "./importacao";

function linha(extra: Partial<LinhaExtrato> = {}): LinhaExtrato {
  return { data: "2026-07-10", descricao: "Compra genérica", valor: -1000, ...extra };
}

describe("normalizarDescricao / similaridadeDescricoes", () => {
  test("remove IBAN, referências e acentos", () => {
    expect(normalizarDescricao("Pagamento PT50000201231234567890154 REF:12345")).not.toContain(
      "pt50",
    );
    expect(normalizarDescricao("Farmácia")).toBe("farmacia");
  });

  test("Jaccard: idêntico = 1, nada em comum = 0", () => {
    expect(similaridadeDescricoes("Continente Lisboa", "Continente Lisboa")).toBe(1);
    expect(similaridadeDescricoes("Continente", "Farmácia")).toBe(0);
  });
});

describe("classificarLancamento — cascata (seção da spec)", () => {
  const parcela: Parcela = {
    id: "p1",
    descricao: "Telemóvel Samsung",
    total: 30000,
    numParcelas: 10,
    primeiroMes: "2026-01",
    categoria: "Eletrónica",
    pagoPorMes: {},
  };

  test("1) parcela: nome similar + valor bate → alta confiança", () => {
    const cls = classificarLancamento(linha({ descricao: "Telemovel Samsung Lda", valor: -3000 }), {
      parcelas: [parcela],
      categoriasConfiguradas: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({
      tipo: "despesa",
      categoria: "Eletrónica",
      incerto: false,
      confianca: "high",
    });
    expect(cls.motivo).toContain("parcela");
  });

  test("2) categoria configurada aparece na descrição → alta confiança", () => {
    const cls = classificarLancamento(linha({ descricao: "Compra em Ginásio Central" }), {
      parcelas: [],
      categoriasConfiguradas: ["Saúde", "Ginásio"],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({
      tipo: "despesa",
      categoria: "Ginásio",
      incerto: false,
      confianca: "high",
    });
  });

  // Mesmo furo do "nos"/"diagnost", um degrau acima na cascata: a categoria
  // configurada também comparava por substring solto.
  test("2b) categoria configurada não pega pedaço de outra palavra", () => {
    const cls = classificarLancamento(
      linha({ descricao: "PRENDA DE CASAMENTO JOANA", valor: -5000 }),
      {
        parcelas: [],
        categoriasConfiguradas: ["Casa", "Presentes"],
        despesasHistorico: [],
        receitasHistorico: [],
      },
    );
    expect(cls.categoria).not.toBe("Casa");
    expect(cls.motivo).not.toContain("categoria: Casa");
  });

  test("2c) a categoria continua a bater quando é a palavra inteira", () => {
    const cls = classificarLancamento(linha({ descricao: "SEGURO DA CASA CONTINUADO" }), {
      parcelas: [],
      categoriasConfiguradas: ["Casa"],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({ categoria: "Casa", confianca: "high" });
  });

  test("3) regra de palavra-chave (Continente → Mercado, categoria configurada na conta)", () => {
    const cls = classificarLancamento(linha({ descricao: "COMPRA CONTINENTE LX" }), {
      parcelas: [],
      categoriasConfiguradas: ["Mercado"],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Mercado", confianca: "high" });
  });

  test("3b) regra de palavra-chave sugere categoria que a conta NÃO tem → cai em 'Outros', não na primeira da lista", () => {
    const cls = classificarLancamento(linha({ descricao: "COMPRA CONTINENTE LX" }), {
      parcelas: [],
      categoriasConfiguradas: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Outros", confianca: "high" });
  });

  test("regra de transferência com sinal de crédito fica marcada incerta", () => {
    const cls = classificarLancamento(linha({ descricao: "TRANSFERENCIA RECEBIDA", valor: 5000 }), {
      parcelas: [],
      categoriasConfiguradas: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls.tipo).toBe("transferencia");
    expect(cls.incerto).toBe(true);
  });

  test("4) fallback: crédito sem correspondência = possível receita; débito = Outros", () => {
    const credito = classificarLancamento(linha({ descricao: "XYZ123", valor: 5000 }), {
      parcelas: [],
      categoriasConfiguradas: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(credito).toMatchObject({
      tipo: "receita",
      categoria: null,
      incerto: true,
      confianca: "low",
    });

    const debito = classificarLancamento(linha({ descricao: "XYZ123", valor: -5000 }), {
      parcelas: [],
      categoriasConfiguradas: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(debito).toMatchObject({
      tipo: "despesa",
      categoria: "Outros",
      incerto: true,
      confianca: "low",
    });
  });

  // Achado num extrato real: pagamento a um instituto de diagnóstico ia para
  // Telemóvel, porque a palavra-chave da operadora "nos " batia dentro de
  // "diagnost". O espaço no fim era a fronteira, mas normalizarDescricao apara-o
  // antes de comparar — mesma família do bug do "mbway".
  test("palavra-chave da operadora não pega pedaço de outra palavra ('nos' em 'diagnost')", () => {
    const cls = classificarLancamento(
      linha({ descricao: "PAGAMENTO INSTITUTO DIAGNOSTICO PORTO", valor: -4500 }),
      {
        parcelas: [],
        categoriasConfiguradas: ["Saúde", "Telemóvel"],
        despesasHistorico: [],
        receitasHistorico: [],
      },
    );
    expect(cls.categoria).not.toBe("Telemóvel");
    expect(cls.motivo).not.toContain('"nos "');
  });

  test("a operadora de verdade continua a bater como palavra inteira", () => {
    const cls = classificarLancamento(linha({ descricao: "NOS COMUNICACOES SA", valor: -3990 }), {
      parcelas: [],
      categoriasConfiguradas: ["Telemóvel"],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Telemóvel", confianca: "high" });
  });

  test("palavra-chave sem espaço no fim continua a valer como prefixo", () => {
    for (const descricao of ["PIZZARIA BELLA", "LABORATORIO CENTRAL", "CUF DIAGNOSTICO LX"]) {
      const cls = classificarLancamento(linha({ descricao, valor: -2000 }), {
        parcelas: [],
        categoriasConfiguradas: ["Restaurante", "Saúde"],
        despesasHistorico: [],
        receitasHistorico: [],
      });
      expect(cls.motivo, descricao).not.toBe("sem correspondência");
    }
  });
});

describe("verificarDuplicata — score-based (seção da spec)", () => {
  const existente: ExistenteParaDedup = {
    id: "e1",
    data: "2026-07-10",
    valor: -4590,
    descricao: "Mercado Continente",
    origem: "despesa",
  };

  test("duplicata exata: mesma data, mesmo valor, descrição quase idêntica", () => {
    const r = verificarDuplicata(linha({ descricao: "Mercado Continente", valor: -4590 }), [
      existente,
    ]);
    expect(r.status).toBe("exact_duplicate");
    expect(r.confianca).toBe("high");
  });

  test("duplicata provável: data próxima, descrição similar", () => {
    const r = verificarDuplicata(
      linha({ data: "2026-07-11", descricao: "Continente Lisboa", valor: -4590 }),
      [existente],
    );
    expect(["duplicate", "possible"]).toContain(r.status);
  });

  test("possível: valor bate mas descrição bem diferente, dentro da janela", () => {
    const r = verificarDuplicata(
      linha({ data: "2026-07-20", descricao: "Compra qualquer", valor: -4590 }),
      [existente],
    );
    expect(r.status === "possible" || r.status === "new").toBe(true);
  });

  test("novo: fora da janela de 14 dias é recorrência legítima, não duplicata", () => {
    const r = verificarDuplicata(
      linha({ data: "2026-07-30", descricao: "Mercado Continente", valor: -4590 }),
      [existente],
    );
    expect(r.status).toBe("new");
  });

  test("novo: sinal diferente (crédito vs débito) nunca é duplicata mesmo com valor igual", () => {
    const r = verificarDuplicata(
      linha({ data: "2026-07-10", descricao: "Mercado Continente", valor: 4590 }),
      [existente],
    );
    expect(r.status).toBe("new");
  });

  test("novo: valor fora da tolerância de 2 cêntimos", () => {
    const r = verificarDuplicata(
      linha({ data: "2026-07-10", descricao: "Mercado Continente", valor: -4600 }),
      [existente],
    );
    expect(r.status).toBe("new");
  });
});

describe("analisarLinha — decisão combinada", () => {
  test("duplicata exata vira decisão duplicata_provavel com ação skip", () => {
    const existente: ExistenteParaDedup = {
      id: "e1",
      data: "2026-07-10",
      valor: -1000,
      origem: "despesa",
      descricao: "Compra genérica",
    };
    const r = analisarLinha(linha(), 0, {
      parcelas: [],
      categoriasConfiguradas: [],
      existentes: [existente],
      locaisCarregamento: [],
      cargasHistorico: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(r.decisao).toBe("duplicata_provavel");
    expect(r.acao).toBe("skip");
  });

  test("sem duplicata e alta confiança vira auto_classificada com ação import", () => {
    const r = analisarLinha(linha({ descricao: "Farmácia Local" }), 0, {
      parcelas: [],
      categoriasConfiguradas: ["Saúde"],
      existentes: [],
      locaisCarregamento: [],
      cargasHistorico: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(r.decisao).toBe("auto_classificada");
    expect(r.acao).toBe("import");
    expect(r.categoriaEscolhida).toBe("Saúde");
  });

  test("sem duplicata e baixa confiança vira nova (revisão de categoria)", () => {
    const r = analisarLinha(linha({ descricao: "ZZZ999" }), 0, {
      parcelas: [],
      categoriasConfiguradas: [],
      existentes: [],
      locaisCarregamento: [],
      cargasHistorico: [],
      despesasHistorico: [],
      receitasHistorico: [],
    });
    expect(r.decisao).toBe("nova");
    expect(r.acao).toBe("import");
  });
});

describe("reconhecerCarga", () => {
  const carga = (descricao: string, valor = -1500) => ({
    data: "2026-07-08",
    descricao,
    valor,
  });

  test("bate com um local já cadastrado e diz qual é", () => {
    const r = reconhecerCarga(carga("POWERDOT PORTUGAL"), ["Casa", "Powerdot", "Ionity A1"]);
    expect(r).toEqual({ ehCarga: true, local: "Powerdot" });
  });

  test("nome do posto com sufixo no extrato ainda bate no cadastrado", () => {
    // "IONITY GMBH" contra "Ionity A1": metade das palavras em comum.
    const r = reconhecerCarga(carga("IONITY GMBH 12/07"), ["Casa", "Ionity A1"]);
    expect(r).toEqual({ ehCarga: true, local: "Ionity A1" });
  });

  test("rede conhecida sem local cadastrado: sugere, mas sem escolher o local", () => {
    const r = reconhecerCarga(carga("FASTNED B.V."), ["Casa"]);
    expect(r).toEqual({ ehCarga: true, local: "" });
  });

  test("compra comum não é carga", () => {
    expect(reconhecerCarga(carga("CONTINENTE MATOSINHOS"), ["Casa", "Ionity A1"])).toEqual({
      ehCarga: false,
      local: "",
    });
  });

  test("abastecer combustível não é recarga elétrica", () => {
    // "Galp" é despesa de Veículo nas regras, mas pedir kWh de um depósito de
    // gasóleo seria pior do que não sugerir nada.
    expect(reconhecerCarga(carga("GALP MATOSINHOS"), [])).toEqual({ ehCarga: false, local: "" });
  });

  test("entrada de dinheiro nunca é carga, mesmo com nome de posto", () => {
    expect(reconhecerCarga(carga("IONITY ESTORNO", 1500), ["Ionity A1"])).toEqual({
      ehCarga: false,
      local: "",
    });
  });

  test("local com nome genérico não apanha qualquer despesa parecida", () => {
    // "Casa" cadastrado como local não pode transformar "CASA DAS RACOES
    // ANIMAIS" numa recarga: uma palavra em três não chega.
    expect(reconhecerCarga(carga("CASA DAS RACOES ANIMAIS"), ["Casa"])).toEqual({
      ehCarga: false,
      local: "",
    });
  });
});

describe("analisarLinha com recarga", () => {
  const base = {
    parcelas: [],
    categoriasConfiguradas: [],
    existentes: [],
    cargasHistorico: [],
    despesasHistorico: [],
    receitasHistorico: [],
  };

  test("posto reconhecido e sem histórico: local preenchido, kWh por escrever", () => {
    const r = analisarLinha(
      { data: "2026-07-08", descricao: "POWERDOT PORTUGAL", valor: -1050 },
      0,
      { ...base, locaisCarregamento: ["Powerdot"] },
    );
    expect(r.destino).toBe("carga");
    expect(r.localCarga).toBe("Powerdot");
    // Sem carga anterior nesse posto não há preço por kWh de onde estimar.
    expect(r.kwhCarga).toBe("");
  });

  test("posto com histórico: o kWh já vem estimado pelo preço da última carga", () => {
    const r = analisarLinha(
      { data: "2026-07-08", descricao: "POWERDOT PORTUGAL", valor: -1050 },
      0,
      {
        ...base,
        locaisCarregamento: ["Powerdot"],
        // 10,50 € a 24 cêntimos/kWh = 43,75 kWh.
        cargasHistorico: [
          { id: "c1", data: "2026-06-01", kwh: 30, precoKwh: 24, custo: 720, local: "Powerdot" },
        ],
      },
    );
    expect(r.kwhCarga).toBe("43,75");
  });

  test("linha comum continua exatamente como antes", () => {
    const r = analisarLinha({ data: "2026-07-08", descricao: "Mercadona", valor: -3200 }, 0, {
      ...base,
      locaisCarregamento: ["Powerdot"],
    });
    expect(r.destino).toBe("lancamento");
    expect(r.localCarga).toBe("");
  });
});

describe("analisarLinha com transferência entre contas próprias", () => {
  const base = {
    parcelas: [],
    categoriasConfiguradas: [],
    existentes: [],
    locaisCarregamento: [],
    cargasHistorico: [],
    despesasHistorico: [],
    receitasHistorico: [],
  };

  test("transferência com dinheiro a ENTRAR já vem sugerida como vinda do cartão", () => {
    // A regra de transferência bate, mas o valor é positivo: contraditório, e
    // é o retrato do cartão de crédito a mandar dinheiro para a conta.
    const r = analisarLinha(
      { data: "2026-07-12", descricao: "Transferência de ActivoBank", valor: 30000 },
      0,
      base,
    );
    expect(r.classificacao.incerto).toBe(true);
    expect(r.destino).toBe("transferencia_cartao");
    // O cartão e a conta são escolha do usuário — não há como adivinhar.
    expect(r.contaOrigem).toBe("");
    expect(r.contaDestino).toBe("");
  });

  test("transferência com dinheiro a SAIR também vem sugerida", () => {
    // Antes ia parar a despesa comum de categoria "Transferência", a inchar o
    // total de gastos com dinheiro que só mudou de conta.
    const r = analisarLinha(
      { data: "2026-07-12", descricao: "Transferência para LUIS", valor: -2000 },
      0,
      base,
    );
    // Sair não é contraditório — a sugestão já não depende disso.
    expect(r.classificacao.incerto).toBe(false);
    expect(r.destino).toBe("transferencia_cartao");
  });

  test("receita comum a entrar não é confundida com transferência", () => {
    const r = analisarLinha({ data: "2026-07-05", descricao: "Salário", valor: 200000 }, 0, base);
    expect(r.destino).toBe("lancamento");
  });

  test("recarga ganha do sinal de transferência — uma saída nunca vem do cartão", () => {
    const r = analisarLinha({ data: "2026-07-08", descricao: "IONITY GMBH", valor: -2480 }, 0, {
      ...base,
      locaisCarregamento: ["Ionity A1"],
    });
    expect(r.destino).toBe("carga");
  });
});

describe("sinal contraditório com o tipo", () => {
  const ctx = {
    parcelas: [],
    categoriasConfiguradas: ["Mercado"],
    locaisCarregamento: [],
    cargasHistorico: [],
    despesasHistorico: [],
    receitasHistorico: [],
    existentes: [],
  };

  test("categoria configurada de despesa com dinheiro a ENTRAR fica incerta", () => {
    // O estorno do supermercado: bate na categoria "Mercado", mas é entrada.
    const r = analisarLinha({ data: "2026-07-20", descricao: "Mercado Amial", valor: 20 }, 0, ctx);
    expect(r.classificacao.incerto).toBe(true);
    // E por isso não passa como auto-classificada — vai para revisão.
    expect(r.decisao).toBe("nova");
  });

  test("regra de despesa com dinheiro a ENTRAR fica incerta", () => {
    const r = analisarLinha({ data: "2026-07-20", descricao: "Mercadona Amial", valor: 20 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(r.classificacao.tipo).toBe("despesa");
    expect(r.classificacao.incerto).toBe(true);
    expect(r.decisao).not.toBe("auto_classificada");
  });

  test("a mesma linha a SAIR continua certa e auto-classificada", () => {
    const r = analisarLinha({ data: "2026-07-20", descricao: "Mercadona Amial", valor: -3200 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(r.classificacao.incerto).toBe(false);
    expect(r.decisao).toBe("auto_classificada");
  });

  test("pagamento de fatura com dinheiro a entrar também é contraditório", () => {
    const r = analisarLinha({ data: "2026-07-20", descricao: "Pagamento cartão", valor: 5000 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(r.classificacao.tipo).toBe("fatura");
    expect(r.classificacao.incerto).toBe(true);
  });

  test("receita com dinheiro a sair continua contraditória, como já era", () => {
    const r = analisarLinha({ data: "2026-07-20", descricao: "Salário", valor: -100 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(r.classificacao.incerto).toBe(true);
  });

  test("o tipo escolhido começa no que a classificação decidiu", () => {
    const receita = analisarLinha({ data: "2026-07-20", descricao: "Salário", valor: 1000 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(receita.tipoEscolhido).toBe("receita");
    const despesa = analisarLinha({ data: "2026-07-20", descricao: "Lidl", valor: -1000 }, 0, {
      ...ctx,
      categoriasConfiguradas: [],
    });
    expect(despesa.tipoEscolhido).toBe("despesa");
    // Transferência colapsa para despesa, como sempre foi.
    const transf = analisarLinha(
      { data: "2026-07-20", descricao: "Transferência para LUIS", valor: -1000 },
      0,
      { ...ctx, categoriasConfiguradas: [] },
    );
    expect(transf.classificacao.tipo).toBe("transferencia");
    expect(transf.tipoEscolhido).toBe("despesa");
  });
});

describe("estimarKwh", () => {
  const carga = (local: string, data: string, precoKwh: number): CargaEletrica => ({
    id: `c-${data}`,
    data,
    kwh: 10,
    precoKwh,
    custo: precoKwh * 10,
    local,
  });

  test("usa o preço da carga MAIS RECENTE daquele posto", () => {
    const cargas = [
      carga("Ionity A1", "2026-05-01", 60),
      carga("Ionity A1", "2026-07-01", 50),
      carga("Casa", "2026-07-02", 10),
    ];
    // 25,00 € a 50 cêntimos/kWh = 50 kWh (e não 41,67, que era o preço antigo).
    expect(estimarKwh(2500, "Ionity A1", cargas)).toBe("50");
  });

  test("posto sem histórico não dá estimativa nenhuma", () => {
    expect(estimarKwh(2500, "Posto Novo", [carga("Casa", "2026-07-02", 10)])).toBe("");
    expect(estimarKwh(2500, "", [carga("Casa", "2026-07-02", 10)])).toBe("");
    expect(estimarKwh(2500, "Casa", [])).toBe("");
  });

  test("decimal com vírgula, como o campo espera", () => {
    expect(estimarKwh(1050, "Casa", [carga("Casa", "2026-07-02", 24)])).toBe("43,75");
  });

  test("carga antiga sem preço não serve de referência", () => {
    const semPreco = { ...carga("Casa", "2026-07-05", 0), precoKwh: 0 };
    expect(estimarKwh(1000, "Casa", [semPreco])).toBe("");
    // Mas uma anterior COM preço ainda serve.
    expect(estimarKwh(1000, "Casa", [semPreco, carga("Casa", "2026-06-01", 20)])).toBe("50");
  });
});

describe("categorização aprendida do histórico", () => {
  const base = {
    parcelas: [],
    categoriasConfiguradas: [],
    despesasHistorico: [{ descricao: "UBER EATS PORTUGAL", categoria: "Restaurante" }],
    receitasHistorico: [],
  };

  test("descrição parecida com uma já classificada herda a categoria", () => {
    const c = classificarLancamento(
      { data: "2026-07-20", descricao: "UBER *EATS", valor: -1800 },
      base,
    );
    expect(c.categoria).toBe("Restaurante");
    expect(c.tipo).toBe("despesa");
    expect(c.confianca).toBe("high");
    expect(c.incerto).toBe(false);
    // Dá para distinguir de "categoria:" e "regra:" quando se investiga.
    expect(c.motivo).toBe("aprendido: UBER EATS PORTUGAL");
  });

  test("o histórico do lado errado não vale", () => {
    // A mesma descrição, mas só em receitas: não pode categorizar uma despesa.
    const c = classificarLancamento(
      { data: "2026-07-20", descricao: "UBER *EATS", valor: -1800 },
      {
        ...base,
        despesasHistorico: [],
        receitasHistorico: [{ descricao: "UBER EATS PORTUGAL", fonte: "Extra" }],
      },
    );
    expect(c.categoria).not.toBe("Extra");
    expect(c.motivo).not.toMatch(/aprendido/);
  });

  test("numa receita, é a fonte que se aprende", () => {
    const c = classificarLancamento(
      // O ref é limpo pela normalização, o resto do nome bate.
      { data: "2026-07-20", descricao: "BOLT OPERATIONS OU REF 998877", valor: 45000 },
      {
        ...base,
        receitasHistorico: [{ descricao: "BOLT OPERATIONS OU", fonte: "TVDE" }],
      },
    );
    expect(c.tipo).toBe("receita");
    expect(c.categoria).toBe("TVDE");
    expect(c.motivo).toMatch(/aprendido/);
  });

  test("entre vários parecidos fica com o mais parecido", () => {
    const c = classificarLancamento(
      { data: "2026-07-20", descricao: "CONTINENTE BOM DIA MATOSINHOS", valor: -1200 },
      {
        ...base,
        despesasHistorico: [
          { descricao: "CONTINENTE ONLINE", categoria: "Mercado" },
          { descricao: "CONTINENTE BOM DIA MATOSINHOS", categoria: "Padaria" },
        ],
      },
    );
    expect(c.categoria).toBe("Padaria");
  });

  test("sem nada parecido, a cascata segue como sempre seguiu", () => {
    // "Farmácia" não está no histórico: cai na regra de palavra-chave.
    const c = classificarLancamento(
      { data: "2026-07-20", descricao: "FARMACIA CENTRAL", valor: -2500 },
      { ...base, categoriasConfiguradas: ["Saúde"] },
    );
    expect(c.categoria).toBe("Saúde");
    expect(c.motivo).not.toMatch(/aprendido/);
  });

  test("o aprendido ganha à regra genérica, que é mais fraca", () => {
    // "Netflix" bate na regra "Lazer", mas o usuário sempre pôs em Assinaturas.
    const c = classificarLancamento(
      { data: "2026-07-20", descricao: "NETFLIX.COM", valor: -1599 },
      {
        ...base,
        categoriasConfiguradas: ["Lazer", "Assinaturas"],
        despesasHistorico: [{ descricao: "NETFLIX.COM", categoria: "Assinaturas" }],
      },
    );
    expect(c.categoria).toBe("Assinaturas");
  });
});

describe("a outra ponta da transferência já registada", () => {
  const base = {
    parcelas: [],
    categoriasConfiguradas: [],
    despesasHistorico: [],
    receitasHistorico: [],
    locaisCarregamento: [],
    cargasHistorico: [],
  };
  // Uma DESPESA comum já lançada — não uma `Transferencia` formal.
  const despesaLancada: ExistenteParaDedup = {
    id: "d1",
    data: "2026-07-18",
    valor: -25000,
    descricao: "Transferência para poupança",
    origem: "despesa",
  };

  test("receita nova acha a despesa do outro lado, apesar do sinal contrário", () => {
    const r = analisarLinha(
      { data: "2026-07-18", descricao: "Transferência recebida", valor: 25000 },
      0,
      { ...base, existentes: [despesaLancada] },
    );
    expect(r.outraPonta?.correspondencia?.id).toBe("d1");
    // A checagem normal (mesmo sinal) não encontra nada — é outro aviso.
    expect(r.duplicata.status).toBe("new");
  });

  test("não bloqueia nem desmarca nada — é só aviso", () => {
    const r = analisarLinha(
      { data: "2026-07-18", descricao: "Transferência recebida", valor: 25000 },
      0,
      { ...base, existentes: [despesaLancada] },
    );
    expect(r.acao).toBe("import");
  });

  test("transferência sem nada do lado oposto não inventa aviso", () => {
    const r = analisarLinha(
      { data: "2026-07-18", descricao: "Transferência recebida", valor: 25000 },
      0,
      { ...base, existentes: [{ ...despesaLancada, valor: -9900 }] },
    );
    expect(r.outraPonta).toBeNull();
  });

  test("linha que não é transferência nunca faz a segunda passagem", () => {
    // Mesmo valor e data do lado oposto, mas isto é uma compra.
    const r = analisarLinha({ data: "2026-07-18", descricao: "Mercadona", valor: 25000 }, 0, {
      ...base,
      existentes: [despesaLancada],
    });
    expect(r.outraPonta).toBeNull();
  });

  test("a duplicata normal, de mesmo sinal, continua a funcionar", () => {
    const r = analisarLinha(
      { data: "2026-07-18", descricao: "Transferência para poupança", valor: -25000 },
      0,
      { ...base, existentes: [despesaLancada] },
    );
    expect(r.duplicata.status).not.toBe("new");
    expect(r.acao).toBe("skip");
    // E do lado oposto não há nada, então nenhum aviso extra.
    expect(r.outraPonta).toBeNull();
  });
});
