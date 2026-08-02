import { describe, expect, test } from "vitest";
import type { ExistenteParaDedup, LinhaExtrato, Parcela } from "../types";
import {
  analisarLinha,
  classificarLancamento,
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
      { parcelas: [], categoriasConfiguradas: ["Casa", "Presentes"] },
    );
    expect(cls.categoria).not.toBe("Casa");
    expect(cls.motivo).not.toContain("categoria: Casa");
  });

  test("2c) a categoria continua a bater quando é a palavra inteira", () => {
    const cls = classificarLancamento(linha({ descricao: "SEGURO DA CASA CONTINUADO" }), {
      parcelas: [],
      categoriasConfiguradas: ["Casa"],
    });
    expect(cls).toMatchObject({ categoria: "Casa", confianca: "high" });
  });

  test("3) regra de palavra-chave (Continente → Mercado, categoria configurada na conta)", () => {
    const cls = classificarLancamento(linha({ descricao: "COMPRA CONTINENTE LX" }), {
      parcelas: [],
      categoriasConfiguradas: ["Mercado"],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Mercado", confianca: "high" });
  });

  test("3b) regra de palavra-chave sugere categoria que a conta NÃO tem → cai em 'Outros', não na primeira da lista", () => {
    const cls = classificarLancamento(linha({ descricao: "COMPRA CONTINENTE LX" }), {
      parcelas: [],
      categoriasConfiguradas: [],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Outros", confianca: "high" });
  });

  test("regra de transferência com sinal de crédito fica marcada incerta", () => {
    const cls = classificarLancamento(linha({ descricao: "TRANSFERENCIA RECEBIDA", valor: 5000 }), {
      parcelas: [],
      categoriasConfiguradas: [],
    });
    expect(cls.tipo).toBe("transferencia");
    expect(cls.incerto).toBe(true);
  });

  test("4) fallback: crédito sem correspondência = possível receita; débito = Outros", () => {
    const credito = classificarLancamento(linha({ descricao: "XYZ123", valor: 5000 }), {
      parcelas: [],
      categoriasConfiguradas: [],
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
      { parcelas: [], categoriasConfiguradas: ["Saúde", "Telemóvel"] },
    );
    expect(cls.categoria).not.toBe("Telemóvel");
    expect(cls.motivo).not.toContain('"nos "');
  });

  test("a operadora de verdade continua a bater como palavra inteira", () => {
    const cls = classificarLancamento(linha({ descricao: "NOS COMUNICACOES SA", valor: -3990 }), {
      parcelas: [],
      categoriasConfiguradas: ["Telemóvel"],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Telemóvel", confianca: "high" });
  });

  test("palavra-chave sem espaço no fim continua a valer como prefixo", () => {
    for (const descricao of ["PIZZARIA BELLA", "LABORATORIO CENTRAL", "CUF DIAGNOSTICO LX"]) {
      const cls = classificarLancamento(linha({ descricao, valor: -2000 }), {
        parcelas: [],
        categoriasConfiguradas: ["Restaurante", "Saúde"],
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
      descricao: "Compra genérica",
    };
    const r = analisarLinha(linha(), 0, {
      parcelas: [],
      categoriasConfiguradas: [],
      existentes: [existente],
      locaisCarregamento: [],
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
  const base = { parcelas: [], categoriasConfiguradas: [], existentes: [] };

  test("linha de posto reconhecido já chega com destino e local preenchidos", () => {
    const r = analisarLinha(
      { data: "2026-07-08", descricao: "POWERDOT PORTUGAL", valor: -1050 },
      0,
      { ...base, locaisCarregamento: ["Powerdot"] },
    );
    expect(r.destino).toBe("carga");
    expect(r.localCarga).toBe("Powerdot");
    // O kWh é o único campo que fica por preencher.
    expect(r.kwhCarga).toBe("");
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

describe("analisarLinha com transferência vinda de cartão", () => {
  const base = { parcelas: [], categoriasConfiguradas: [], existentes: [], locaisCarregamento: [] };

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
    expect(r.cartaoOrigem).toBe("");
    expect(r.contaDestino).toBe("");
  });

  test("transferência com dinheiro a SAIR continua no caminho normal", () => {
    const r = analisarLinha(
      { data: "2026-07-12", descricao: "Transferência para LUIS", valor: -2000 },
      0,
      base,
    );
    expect(r.classificacao.incerto).toBe(false);
    expect(r.destino).toBe("lancamento");
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
