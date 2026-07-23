import { describe, expect, test } from "vitest";
import type { ExistenteParaDedup, LinhaExtrato, Parcela } from "../types";
import {
  analisarLinha,
  classificarLancamento,
  normalizarDescricao,
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

  test("3) regra de palavra-chave (Continente → Mercado)", () => {
    const cls = classificarLancamento(linha({ descricao: "COMPRA CONTINENTE LX" }), {
      parcelas: [],
      categoriasConfiguradas: [],
    });
    expect(cls).toMatchObject({ tipo: "despesa", categoria: "Mercado", confianca: "high" });
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
    });
    expect(r.decisao).toBe("duplicata_provavel");
    expect(r.acao).toBe("skip");
  });

  test("sem duplicata e alta confiança vira auto_classificada com ação import", () => {
    const r = analisarLinha(linha({ descricao: "Farmácia Local" }), 0, {
      parcelas: [],
      categoriasConfiguradas: ["Saúde"],
      existentes: [],
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
    });
    expect(r.decisao).toBe("nova");
    expect(r.acao).toBe("import");
  });
});
