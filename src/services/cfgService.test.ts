// Configuração da conta, com o firebase/database trocado por uma dobra em
// memória — mesmo padrão de parcelasService.test.ts e faturaService.test.ts.
//
// Duas coisas justificam estes testes. A primeira é o par apagar/gravar: meia
// dúzia destas funções tratam `null`, `0` e `""` como "apaga a chave" em vez de
// "grava este valor", e a diferença não é cosmética — um `0` gravado em
// saldoInicial é um saldo de zero euros afirmado, enquanto a chave ausente
// significa "nunca foi definido". A segunda é a limpeza ao remover um cartão:
// se o tipo ou os dias de fatura ficassem para trás, o nome reaparecia meio
// configurado assim que alguém criasse outro cartão com o mesmo nome.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";

let updates: { caminho: string; mudancas: Record<string, unknown> }[] = [];
let sets: { caminho: string; valor: unknown }[] = [];
let removes: string[] = [];

vi.mock("./firebase", () => ({ db: {} }));

const snapshot = vi.fn();
vi.mock("../stores/historicoStore", () => ({ snapshotHistorico: () => snapshot() }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  set: async (r: { caminho: string }, valor: unknown) => {
    sets.push({ caminho: r.caminho, valor });
  },
  remove: async (r: { caminho: string }) => {
    removes.push(r.caminho);
  },
  update: async (r: { caminho: string }, mudancas: Record<string, unknown>) => {
    updates.push({ caminho: r.caminho, mudancas });
  },
  onValue: (_r: unknown, cb: (snap: { val: () => unknown }) => void) => {
    onValueCb = cb;
    return () => {
      desinscrito = true;
    };
  },
  push: (r: { caminho: string }) => ({ caminho: `${r.caminho}/k1`, key: "k1" }),
  get: async () => ({ val: () => null }),
}));

let onValueCb: ((snap: { val: () => unknown }) => void) | null = null;
let desinscrito = false;

const s = await import("./cfgService");

const UID = "u1";
const CFG = `users/${UID}/fin_v5/cfg`;

const cfg = (over: Partial<ConfigConta> = {}): ConfigConta => ({
  ...CONFIG_PADRAO,
  ...over,
});

beforeEach(() => {
  updates = [];
  sets = [];
  removes = [];
  onValueCb = null;
  desinscrito = false;
  snapshot.mockClear();
});

describe("normalizarConfig", () => {
  test("null vira a config padrão inteira", () => {
    // O RTDB não devolve nada para uma conta nova. Sem isto, a app arrancava
    // sem moeda, sem categorias e sem listas — e todas as telas liam undefined.
    expect(s.normalizarConfig(null)).toEqual(CONFIG_PADRAO);
  });

  test("repõe campo a campo o que o RTDB omitiu", () => {
    // O RTDB omite objectos e arrays vazios: uma conta que apagou todas as
    // categorias volta sem a chave, não com [].
    const normalizada = s.normalizarConfig({ currency: "BRL" });
    expect(normalizada.currency).toBe("BRL");
    expect(normalizada.categoriasDespesa).toEqual(CONFIG_PADRAO.categoriasDespesa);
    expect(normalizada.contasCartoes).toEqual(CONFIG_PADRAO.contasCartoes);
  });

  test("o que veio do RTDB ganha ao padrão", () => {
    const normalizada = s.normalizarConfig({ contasCartoes: ["Só este"] });
    expect(normalizada.contasCartoes).toEqual(["Só este"]);
  });
});

describe("observarConfig", () => {
  test("entrega a config já normalizada, não o bruto", () => {
    const recebidas: ConfigConta[] = [];
    s.observarConfig(
      UID,
      (c) => recebidas.push(c),
      () => {},
    );

    onValueCb!({ val: () => ({ currency: "BRL" }) });

    expect(recebidas).toHaveLength(1);
    // Quem subscreve nunca vê um objecto pela metade.
    expect(recebidas[0].currency).toBe("BRL");
    expect(recebidas[0].categoriasDespesa).toEqual(CONFIG_PADRAO.categoriasDespesa);
  });

  test("devolve a função que corta a subscrição", () => {
    const parar = s.observarConfig(
      UID,
      () => {},
      () => {},
    );
    parar();
    expect(desinscrito).toBe(true);
  });
});

describe("adicionarCartao", () => {
  test("acrescenta à lista e grava o tipo na mesma escrita", async () => {
    await s.adicionarCartao(UID, cfg({ contasCartoes: ["Conta"] }), "Gold", "credit");

    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(CFG);
    expect(updates[0].mudancas.contasCartoes).toEqual(["Conta", "Gold"]);
    // Sem o tipo na MESMA escrita, um cartão de crédito podia existir um
    // instante sem tipo — e nesse instante não entra no fluxo de fatura.
    expect(updates[0].mudancas["tipoCartao/Gold"]).toBe("credit");
  });

  test("recusa nome repetido sem escrever nada", async () => {
    await expect(
      s.adicionarCartao(UID, cfg({ contasCartoes: ["Gold"] }), "Gold", "debit"),
    ).rejects.toThrow(/Já existe/);
    expect(updates).toHaveLength(0);
    // E não gasta um ponto de histórico com uma operação que não aconteceu.
    expect(snapshot).not.toHaveBeenCalled();
  });
});

describe("removerCartao", () => {
  test("tira da lista e limpa todas as chaves derivadas do nome", async () => {
    await s.removerCartao(UID, cfg({ contasCartoes: ["Conta", "Gold"] }), "Gold");

    const m = updates[0].mudancas;
    expect(m.contasCartoes).toEqual(["Conta"]);
    // Se qualquer uma destas ficasse para trás, criar outro cartão com o mesmo
    // nome trazia de volta o tipo e os dias de fatura do antigo.
    expect(m["tipoCartao/Gold"]).toBeNull();
    expect(m["diaVencimentoFatura/Gold"]).toBeNull();
    expect(m["diaFechamentoFatura/Gold"]).toBeNull();
  });
});

describe("dias de fatura", () => {
  test.each([
    ["definirDiaVencimentoFatura", "diaVencimentoFatura"] as const,
    ["definirDiaFechamentoFatura", "diaFechamentoFatura"] as const,
  ])("%s aceita 1-31 e rejeita o resto", async (fn, chave) => {
    for (const dia of [1, 15, 31]) {
      updates = [];
      await s[fn](UID, "Gold", dia);
      expect(updates[0].mudancas[`${chave}/Gold`]).toBe(dia);
    }

    // 0, negativo, acima de 31 e null caem todos em "apaga a chave" — e não em
    // gravar um dia impossível, que depois faria a fatura vencer em lado nenhum.
    for (const dia of [0, -1, 32, 99, null]) {
      updates = [];
      await s[fn](UID, "Gold", dia);
      expect(updates[0].mudancas[`${chave}/Gold`]).toBeNull();
    }
  });
});

describe("listas configuráveis", () => {
  test("adiciona item com o espaço à volta aparado", async () => {
    await s.adicionarItemLista(
      UID,
      cfg({ categoriasDespesa: ["Casa"] }),
      "categoriasDespesa",
      "  Lazer  ",
    );
    expect(updates[0].mudancas.categoriasDespesa).toEqual(["Casa", "Lazer"]);
  });

  test("recusa vazio e só-espaços", async () => {
    const c = cfg({ categoriasDespesa: ["Casa"] });
    await expect(s.adicionarItemLista(UID, c, "categoriasDespesa", "")).rejects.toThrow(/vazio/i);
    await expect(s.adicionarItemLista(UID, c, "categoriasDespesa", "   ")).rejects.toThrow(
      /vazio/i,
    );
    expect(updates).toHaveLength(0);
  });

  test("recusa repetido comparando já sem espaços", async () => {
    const c = cfg({ categoriasDespesa: ["Casa"] });
    await expect(s.adicionarItemLista(UID, c, "categoriasDespesa", " Casa ")).rejects.toThrow(
      /Já existe/,
    );
  });

  test("remover tira só o item pedido", async () => {
    await s.removerItemLista(
      UID,
      cfg({ categoriasDespesa: ["Casa", "Lazer", "Carro"] }),
      "categoriasDespesa",
      "Lazer",
    );
    expect(updates[0].mudancas.categoriasDespesa).toEqual(["Casa", "Carro"]);
  });
});

describe("gravar valor vs apagar chave", () => {
  // Este bloco existe por um motivo só: nestas funções, "apagar" e "gravar
  // zero" são coisas diferentes, e é fácil trocá-las sem nada falhar à vista.

  test("definirOrcamento: valor grava, 0 e null apagam", async () => {
    await s.definirOrcamento(UID, "Casa", 5000);
    expect(sets).toEqual([{ caminho: `${CFG}/orcamentos/Casa`, valor: 5000 }]);

    sets = [];
    await s.definirOrcamento(UID, "Casa", 0);
    await s.definirOrcamento(UID, "Casa", null);
    // Teto de 0 € não é um teto: seria um orçamento que está sempre estourado.
    expect(sets).toHaveLength(0);
    expect(removes).toEqual([`${CFG}/orcamentos/Casa`, `${CFG}/orcamentos/Casa`]);
  });

  test("definirOrcamentoTotal: valor grava, 0 e null apagam", async () => {
    await s.definirOrcamentoTotal(UID, 150000);
    expect(sets).toEqual([{ caminho: `${CFG}/orcamentoTotalMensal`, valor: 150000 }]);

    sets = [];
    await s.definirOrcamentoTotal(UID, 0);
    await s.definirOrcamentoTotal(UID, null);
    // Mesma razão do teto por categoria: um total de 0 € seria um plano sempre
    // estourado, e o que se quer dizer é "não definido".
    expect(sets).toHaveLength(0);
    expect(removes).toEqual([`${CFG}/orcamentoTotalMensal`, `${CFG}/orcamentoTotalMensal`]);
  });

  test("definirSaldoInicial: 0 apaga, negativo grava", async () => {
    await s.definirSaldoInicial(UID, "Conta", 0);
    expect(removes).toEqual([`${CFG}/saldosIniciais/Conta`]);

    // Negativo tem de GRAVAR: uma conta pode começar a descoberto, e apagar
    // aqui apagaria a informação em vez de a guardar.
    await s.definirSaldoInicial(UID, "Conta", -2500);
    expect(sets).toEqual([{ caminho: `${CFG}/saldosIniciais/Conta`, valor: -2500 }]);
  });

  test("definirFaturaManual: 0 GRAVA, só null apaga", async () => {
    // Ao contrário do orçamento: uma fatura de 0,00 é uma afirmação legítima
    // ("este mês não devo nada"), e é diferente de não haver override nenhum,
    // que devolve o cálculo automático.
    await s.definirFaturaManual(UID, "Gold", "2026-08", 0);
    expect(sets).toEqual([{ caminho: `${CFG}/faturaManual/Gold/2026-08`, valor: 0 }]);
    expect(removes).toHaveLength(0);

    await s.definirFaturaManual(UID, "Gold", "2026-08", null);
    expect(removes).toEqual([`${CFG}/faturaManual/Gold/2026-08`]);
  });

  test("definirIconeCategoria e definirCorCategoria: null e '' apagam", async () => {
    await s.definirIconeCategoria(UID, "Casa", "utensils");
    await s.definirCorCategoria(UID, "Casa", "#ff0000");
    expect(sets).toEqual([
      { caminho: `${CFG}/categoriaIcone/Casa`, valor: "utensils" },
      { caminho: `${CFG}/categoriaCor/Casa`, valor: "#ff0000" },
    ]);

    sets = [];
    await s.definirIconeCategoria(UID, "Casa", null);
    await s.definirIconeCategoria(UID, "Casa", "");
    await s.definirCorCategoria(UID, "Casa", null);
    await s.definirCorCategoria(UID, "Casa", "");
    // String vazia tem de apagar como o null: é o que o seletor devolve quando
    // se limpa a escolha, e gravá-la deixava a categoria com um ícone "".
    expect(sets).toHaveLength(0);
    expect(removes).toHaveLength(4);
  });

  test("definirCorApp guarda por tema, em namespace separado das categorias", async () => {
    await s.definirCorApp(UID, "dark", "blu", "#123456");
    await s.definirCorApp(UID, "light", "blu", "#654321");

    expect(sets).toEqual([
      { caminho: `${CFG}/coresApp/dark/blu`, valor: "#123456" },
      { caminho: `${CFG}/coresApp/light/blu`, valor: "#654321" },
    ]);

    await s.definirCorApp(UID, "dark", "blu", null);
    expect(removes).toEqual([`${CFG}/coresApp/dark/blu`]);
  });
});

describe("histórico", () => {
  test("toda operação que escreve guarda um ponto antes", async () => {
    await s.definirOrcamento(UID, "Casa", 5000);
    expect(snapshot).toHaveBeenCalledTimes(1);

    await s.definirSaldoInicial(UID, "Conta", 100);
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  test("atualizarConfig NÃO guarda ponto", async () => {
    // É o caminho das preferências de interface (tema, KPIs escolhidos, modo
    // discreto). Encher o desfazer com isso empurrava para fora do histórico as
    // alterações de dinheiro, que são as que interessa poder desfazer.
    await s.atualizarConfig(UID, { currency: "BRL" });
    expect(updates).toHaveLength(1);
    expect(snapshot).not.toHaveBeenCalled();
  });
});
