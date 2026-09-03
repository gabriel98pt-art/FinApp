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
import { comInstituicoes, instituicao } from "../testes/instituicoes";
import type { ConfigConta, Instituicao } from "../types";

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

/** Conta já migrada: `instituicoes` existe gravada, e os campos antigos são a
 *  vista derivada dela — exactamente o que `normalizarConfig` devolve. */
const migrada = (...insts: Instituicao[]): ConfigConta => cfg(comInstituicoes(...insts));

/** Conta ainda no formato antigo: só os campos antigos estão gravados e
 *  `instituicoes` foi sintetizada em memória. É o estado em que TODA a gente
 *  está no dia em que isto entra em produção. */
const porMigrar = (contas: string[]): ConfigConta => s.normalizarConfig({ contasCartoes: contas });

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

// A ponte entre `instituicoes` e os quatro campos antigos de conta/cartão.
// Vale testes próprios (e não só de raspão, através de outra coisa) porque é
// o único ponto do app que sabe em que lado da migração uma conta está: se
// esta função se enganar num sentido, uma conta migrada perde os cartões de
// TODAS as telas que ainda leem os campos antigos; se se enganar no outro,
// uma conta por migrar aparece sem instituição nenhuma.
describe("normalizarConfig — instituições", () => {
  describe("conta ainda no formato antigo", () => {
    test("sintetiza uma instituição com um método por conta/cartão", () => {
      const c = s.normalizarConfig({
        contasCartoes: ["Conta", "Gold"],
        tipoCartao: { Conta: "debit", Gold: "credit" },
        diaVencimentoFatura: { Gold: 8 },
        diaFechamentoFatura: { Gold: 28 },
      });

      expect(c.instituicoes).toEqual([
        { id: "Conta", nome: "Conta", metodos: [{ id: "Conta", tipo: "debito" }] },
        {
          id: "Gold",
          nome: "Gold",
          metodos: [
            { id: "Gold", tipo: "credito", diaFechamentoFatura: 28, diaVencimentoFatura: 8 },
          ],
        },
      ]);
    });

    test("o id do método é o nome de hoje — é isso que dispensa migrar lançamentos", () => {
      const c = s.normalizarConfig({ contasCartoes: ["AB Gold (C)"] });
      expect(c.instituicoes[0].metodos[0].id).toBe("AB Gold (C)");
    });

    test("os quatro campos antigos ficam exactamente como vieram", () => {
      // Neste sentido é o formato antigo que manda: sintetizar não pode
      // reordenar nem reescrever nada, senão a etapa muda comportamento.
      const bruto = {
        contasCartoes: ["Zeta", "Alfa"],
        tipoCartao: { Zeta: "credit" as const },
        diaVencimentoFatura: { Zeta: 3 },
      };
      const c = s.normalizarConfig(bruto);

      expect(c.contasCartoes).toEqual(["Zeta", "Alfa"]);
      expect(c.tipoCartao).toEqual({ Zeta: "credit" });
      expect(c.diaVencimentoFatura).toEqual({ Zeta: 3 });
      expect(c.diaFechamentoFatura).toEqual({});
    });

    test("cartão sem tipo gravado conta como débito", () => {
      // É o que o resto do app já assume: só entra no fluxo de fatura quem
      // tem `tipoCartao` a dizer "credit".
      const c = s.normalizarConfig({ contasCartoes: ["Sem tipo"] });
      expect(c.instituicoes[0].metodos[0].tipo).toBe("debito");
    });

    test("crédito sem dias de fatura não inventa dias", () => {
      const c = s.normalizarConfig({
        contasCartoes: ["Gold"],
        tipoCartao: { Gold: "credit" },
      });
      const metodo = c.instituicoes[0].metodos[0];
      expect(metodo).toEqual({ id: "Gold", tipo: "credito" });
      expect("diaVencimentoFatura" in metodo).toBe(false);
      expect("diaFechamentoFatura" in metodo).toBe(false);
    });

    test("dia fora de 1-31 é ignorado em vez de virar um método inválido", () => {
      const c = s.normalizarConfig({
        contasCartoes: ["Gold"],
        tipoCartao: { Gold: "credit" },
        // 0 é como as telas apagam o dia; 45 seria lixo gravado.
        diaVencimentoFatura: { Gold: 0 },
        diaFechamentoFatura: { Gold: 45 },
      });
      expect(c.instituicoes[0].metodos[0]).toEqual({ id: "Gold", tipo: "credito" });
    });

    test("conta sem cartão nenhum fica com lista vazia, não com undefined", () => {
      expect(s.normalizarConfig(null).instituicoes).toEqual([]);
      expect(s.normalizarConfig({ contasCartoes: [] }).instituicoes).toEqual([]);
    });
  });

  describe("conta já migrada (instituições no RTDB)", () => {
    test("converte o mapa indexado por id para lista e deriva os campos antigos", () => {
      const c = s.normalizarConfig({
        instituicoes: {
          banco1: {
            nome: "Banco Novo",
            metodos: {
              "Conta Velha": { tipo: "debito" },
              "Gold Velho": {
                tipo: "credito",
                diaFechamentoFatura: 28,
                diaVencimentoFatura: 8,
              },
            },
          },
        },
      });

      expect(c.instituicoes).toEqual([
        {
          id: "banco1",
          nome: "Banco Novo",
          metodos: [
            { id: "Conta Velha", tipo: "debito" },
            {
              id: "Gold Velho",
              tipo: "credito",
              diaFechamentoFatura: 28,
              diaVencimentoFatura: 8,
            },
          ],
        },
      ]);
      // Os ids dos métodos — e não o nome da instituição — é que alimentam os
      // campos antigos: é assim que renomear o banco não órfã lançamento
      // nenhum.
      expect(c.contasCartoes).toEqual(["Conta Velha", "Gold Velho"]);
      expect(c.tipoCartao).toEqual({ "Conta Velha": "debit", "Gold Velho": "credit" });
      expect(c.diaVencimentoFatura).toEqual({ "Gold Velho": 8 });
      expect(c.diaFechamentoFatura).toEqual({ "Gold Velho": 28 });
    });

    test("os campos antigos gravados são descartados, não misturados", () => {
      // Numa conta migrada `instituicoes` é a única fonte de verdade. Se um
      // resto antigo sobrevivesse, um cartão apagado ressuscitava nos
      // seletores.
      const c = s.normalizarConfig({
        instituicoes: { b1: { nome: "Banco", metodos: { Ativo: { tipo: "debito" } } } },
        contasCartoes: ["Apagado"],
        tipoCartao: { Apagado: "credit" },
        diaVencimentoFatura: { Apagado: 10 },
        diaFechamentoFatura: { Apagado: 20 },
      });

      expect(c.contasCartoes).toEqual(["Ativo"]);
      expect(c.tipoCartao).toEqual({ Ativo: "debit" });
      expect(c.diaVencimentoFatura).toEqual({});
      expect(c.diaFechamentoFatura).toEqual({});
    });

    test("instituição sem métodos não deixa nada para trás nos campos antigos", () => {
      const c = s.normalizarConfig({
        instituicoes: { b1: { nome: "Banco vazio" } },
      });

      expect(c.instituicoes).toEqual([{ id: "b1", nome: "Banco vazio", metodos: [] }]);
      expect(c.contasCartoes).toEqual([]);
      expect(c.tipoCartao).toEqual({});
    });

    test("instituição sem nome gravado usa o id — o RTDB omite string vazia", () => {
      const c = s.normalizarConfig({
        instituicoes: { "Banco X": { metodos: { "Banco X": { tipo: "debito" } } } },
      });
      expect(c.instituicoes[0].nome).toBe("Banco X");
    });

    test("guarda o nome de exibição quando existe e não inventa um quando não", () => {
      const c = s.normalizarConfig({
        instituicoes: {
          b1: {
            nome: "Banco",
            metodos: {
              m1: { tipo: "credito", nomeExibicao: "O cartão das compras" },
              m2: { tipo: "debito" },
            },
          },
        },
      });

      expect(c.instituicoes[0].metodos[0].nomeExibicao).toBe("O cartão das compras");
      // Ausente é o estado normal: quem exibe é que deriva
      // "{instituição} · Débito/Crédito".
      expect("nomeExibicao" in c.instituicoes[0].metodos[1]).toBe(false);
    });

    test("mapa de instituições vazio cai no formato antigo, não numa conta sem cartões", () => {
      // O RTDB omite objectos vazios, mas se um chegar vazio na mesma, tratar
      // isso como "já migrada" apagava todas as contas da tela.
      const c = s.normalizarConfig({
        instituicoes: {},
        contasCartoes: ["Conta"],
        tipoCartao: { Conta: "debit" },
      });

      expect(c.contasCartoes).toEqual(["Conta"]);
      expect(c.instituicoes).toEqual([
        { id: "Conta", nome: "Conta", metodos: [{ id: "Conta", tipo: "debito" }] },
      ]);
    });
  });

  test("ida e volta pelo formato antigo não perde nada", () => {
    // Sintetizar e derivar de volta tem de dar exactamente o mesmo — é esta
    // igualdade que garante que gravar a migração (etapa seguinte) não muda
    // uma vírgula do que as telas mostram hoje.
    const antigo = {
      contasCartoes: ["Conta", "Gold"],
      tipoCartao: { Conta: "debit" as const, Gold: "credit" as const },
      diaVencimentoFatura: { Gold: 8 },
      diaFechamentoFatura: { Gold: 28 },
    };
    const sintetizada = s.normalizarConfig(antigo);

    const migrada = s.normalizarConfig({
      instituicoes: Object.fromEntries(
        sintetizada.instituicoes.map((i) => [
          i.id,
          { nome: i.nome, metodos: Object.fromEntries(i.metodos.map(({ id, ...m }) => [id, m])) },
        ]),
      ),
    });

    expect(migrada.contasCartoes).toEqual(antigo.contasCartoes);
    expect(migrada.tipoCartao).toEqual(antigo.tipoCartao);
    expect(migrada.diaVencimentoFatura).toEqual(antigo.diaVencimentoFatura);
    expect(migrada.diaFechamentoFatura).toEqual(antigo.diaFechamentoFatura);
    expect(migrada.instituicoes).toEqual(sintetizada.instituicoes);
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
  test("cria a instituição com um método, e mantém os campos antigos coerentes", async () => {
    await s.adicionarCartao(UID, migrada(instituicao("Conta")), "Gold", "credit");

    expect(updates).toHaveLength(1);
    expect(updates[0].caminho).toBe(CFG);
    const m = updates[0].mudancas;
    expect(m["instituicoes/Gold"]).toEqual({
      nome: "Gold",
      metodos: { Gold: { tipo: "credito" } },
    });
    // O id do método é o nome de hoje — o mesmo que a migração 1:1 usa, e o
    // mesmo que fica gravado em cada lançamento feito neste cartão.
    expect(m.contasCartoes).toEqual(["Conta", "Gold"]);
    // Sem o tipo na MESMA escrita, um cartão de crédito podia existir um
    // instante sem tipo — e nesse instante não entra no fluxo de fatura.
    expect(m["tipoCartao/Gold"]).toBe("credit");
  });

  test("recusa nome repetido sem escrever nada", async () => {
    await expect(
      s.adicionarCartao(UID, migrada(instituicao("Gold")), "Gold", "debit"),
    ).rejects.toThrow(/Já existe/);
    expect(updates).toHaveLength(0);
    // E não gasta um ponto de histórico com uma operação que não aconteceu.
    expect(snapshot).not.toHaveBeenCalled();
  });

  test("recusa caractere que o RTDB não aceita numa chave — o nome vira id", async () => {
    await expect(s.adicionarCartao(UID, migrada(), "A/B", "debit")).rejects.toThrow(/não pode ter/);
    expect(updates).toHaveLength(0);
  });

  test("id livre quando o nome já foi usado por um id que ficou para trás", async () => {
    // "Gold" foi renomeado para "Gold Antigo" e o id ficou a ser "Gold".
    // Criar agora outro cartão chamado "Gold" não pode reusar esse id: os
    // lançamentos dos dois passavam a apontar para o mesmo sítio.
    const cfgAtual = migrada(instituicao("Gold Antigo", "credito", { id: "Gold" }));
    await s.adicionarCartao(UID, cfgAtual, "Gold", "debit");

    const m = updates[0].mudancas;
    expect(m["instituicoes/Gold 2"]).toEqual({
      nome: "Gold",
      metodos: { "Gold 2": { tipo: "debito" } },
    });
    expect(m.contasCartoes).toEqual(["Gold", "Gold 2"]);
  });

  test("conta ainda por migrar grava a árvore INTEIRA, não só a conta nova", async () => {
    // Gravar só o ramo novo faria a leitura seguinte dar a conta por migrada —
    // e as contas que já lá estavam desapareciam da lista.
    await s.adicionarCartao(UID, porMigrar(["Conta", "Gold"]), "Novo", "debit");

    const escritas = updates[0].mudancas.instituicoes as Record<string, unknown>;
    expect(Object.keys(escritas)).toEqual(["Conta", "Gold", "Novo"]);
    expect(updates[0].mudancas["instituicoes/Novo"]).toBeUndefined();
  });
});

describe("adicionarMetodo", () => {
  test("cria o método dentro da MESMA instituição, sem pedir nome novo", async () => {
    await s.adicionarMetodo(UID, migrada(instituicao("Banco X")), "Banco X", "credit");

    expect(updates).toHaveLength(1);
    const m = updates[0].mudancas;
    // O id não é "Banco X" (já em uso pelo método de débito) — o nome com o
    // tipo desempata, mesmo texto que `nomeAtualDoMetodo` vai mostrar.
    expect(m["instituicoes/Banco X/metodos/Banco X · Crédito"]).toEqual({ tipo: "credito" });
    expect(m.contasCartoes).toEqual(["Banco X", "Banco X · Crédito"]);
    expect(m["tipoCartao/Banco X · Crédito"]).toBe("credit");
  });

  test("recusa instituição que já não existe", async () => {
    await expect(
      s.adicionarMetodo(UID, migrada(instituicao("Banco X")), "Sumiu", "debit"),
    ).rejects.toThrow(/já não existe/);
    expect(updates).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });

  test("conta ainda por migrar grava a árvore INTEIRA, não só o método novo", async () => {
    await s.adicionarMetodo(UID, porMigrar(["Banco X"]), "Banco X", "credit");

    const escritas = updates[0].mudancas.instituicoes as Record<string, unknown>;
    expect(Object.keys(escritas)).toEqual(["Banco X"]);
    expect(updates[0].mudancas["instituicoes/Banco X/metodos/Banco X · Crédito"]).toBeUndefined();
  });

  // P0 de 26/08: uma instituição real apareceu sem `metodos` gravado — o
  // espalhamento `[...i.metodos, novo]` sem guarda derrubava isto (e, por
  // extensão, qualquer tela que chamasse esta função) com "is not iterable".
  test("instituição sem metodos gravado não lança — o método novo entra sozinho", async () => {
    // Não usa `migrada()`/`comInstituicoes` de propósito: esse helper também
    // percorre `inst.metodos` para derivar os campos antigos, e lançaria na
    // MONTAGEM do teste em vez de exercitar `adicionarMetodo`.
    const semMetodos = { id: "Quebrada", nome: "Quebrada" } as Instituicao;
    const cfgQuebrada = cfg({ instituicoes: [semMetodos], instituicoesGravadas: true });
    await s.adicionarMetodo(UID, cfgQuebrada, "Quebrada", "debit");

    const m = updates[0].mudancas;
    expect(m["instituicoes/Quebrada/metodos/Quebrada · Débito"]).toEqual({ tipo: "debito" });
  });
});

describe("renomearCartao", () => {
  test("é uma escrita só, no nome da instituição — sem tocar em lançamento nenhum", async () => {
    await s.renomearCartao(UID, migrada(instituicao("Gold", "credito")), "Gold", "Gold Novo");

    expect(updates).toHaveLength(1);
    // Na raiz da conta é que era a cascata; agora é dentro de cfg e num campo só.
    expect(updates[0].caminho).toBe(CFG);
    expect(updates[0].mudancas).toEqual({ "instituicoes/Gold/nome": "Gold Novo" });
  });

  test("o id do método não muda — é ele que os lançamentos guardam", async () => {
    const antes = migrada(instituicao("Gold"));
    await s.renomearCartao(UID, antes, "Gold", "Outro Nome");

    expect(updates[0].mudancas["instituicoes/Gold/id"]).toBeUndefined();
    expect(updates[0].mudancas.contasCartoes).toBeUndefined();
  });

  test("recusa nome de outra instituição, aceita variação do próprio", async () => {
    const cfgAtual = migrada(instituicao("Conta"), instituicao("Gold", "credito"));
    await expect(s.renomearCartao(UID, cfgAtual, "Gold", "Conta")).rejects.toThrow(/Já existe/);
    await expect(s.renomearCartao(UID, cfgAtual, "Gold", "Gold")).rejects.toThrow(/o mesmo/);
    expect(updates).toHaveLength(0);
  });

  test("recusa id que já não existe em vez de gravar num ramo inventado", async () => {
    await expect(
      s.renomearCartao(UID, migrada(instituicao("Conta")), "Sumiu", "X"),
    ).rejects.toThrow(/já não existe/);
    expect(updates).toHaveLength(0);
  });

  test("conta ainda por migrar grava a árvore inteira já com o nome novo", async () => {
    await s.renomearCartao(UID, porMigrar(["Conta", "Gold"]), "Gold", "Gold Novo");

    expect(updates[0].mudancas.instituicoes).toEqual({
      Conta: { nome: "Conta", metodos: { Conta: { tipo: "debito" } } },
      Gold: { nome: "Gold Novo", metodos: { Gold: { tipo: "debito" } } },
    });
  });
});

describe("removerCartao", () => {
  test("tira a instituição e limpa todas as chaves antigas derivadas do id", async () => {
    const cfgAtual = migrada(instituicao("Conta"), instituicao("Gold", "credito"));
    await s.removerCartao(UID, cfgAtual, "Gold");

    const m = updates[0].mudancas;
    expect(m["instituicoes/Gold"]).toBeNull();
    // Se qualquer uma destas ficasse para trás, criar outro cartão com o mesmo
    // nome trazia de volta o tipo e os dias de fatura do antigo. E se
    // `instituicoes` ficar vazia, é delas que a leitura seguinte parte — uma
    // conta apagada ressuscitava.
    expect(m.contasCartoes).toEqual(["Conta"]);
    expect(m["tipoCartao/Gold"]).toBeNull();
    expect(m["diaVencimentoFatura/Gold"]).toBeNull();
    expect(m["diaFechamentoFatura/Gold"]).toBeNull();
  });

  test("remover a última deixa os dois lados vazios ao mesmo tempo", async () => {
    await s.removerCartao(UID, migrada(instituicao("Gold", "credito")), "Gold");

    const m = updates[0].mudancas;
    expect(m["instituicoes/Gold"]).toBeNull();
    expect(m.contasCartoes).toEqual([]);
  });

  // Achado ao investigar um relato de "Banco Teste QA" sobrando em
  // `faturaManual` numa conta real (03/09/2026): estes três também são
  // chaveados pelo id da conta/cartão, mas não entravam na limpeza — uma
  // conta criada e removida deixava saldo/fatura órfãos pra sempre.
  test("limpa saldosIniciais/faturaManual/faturasPagas — também chaveados pelo id da conta", async () => {
    const cfgAtual = migrada(instituicao("Gold", "credito"));
    await s.removerCartao(UID, cfgAtual, "Gold");

    const m = updates[0].mudancas;
    expect(m["saldosIniciais/Gold"]).toBeNull();
    expect(m["faturaManual/Gold"]).toBeNull();
    expect(m["faturasPagas/Gold"]).toBeNull();
  });
});

describe("dias de fatura", () => {
  test.each([
    ["definirDiaVencimentoFatura", "diaVencimentoFatura"] as const,
    ["definirDiaFechamentoFatura", "diaFechamentoFatura"] as const,
  ])("%s aceita 1-31 e rejeita o resto", async (fn, chave) => {
    const cfgAtual = migrada(instituicao("Gold", "credito"));
    for (const dia of [1, 15, 31]) {
      updates = [];
      await s[fn](UID, cfgAtual, "Gold", dia);
      expect(updates[0].mudancas[`instituicoes/Gold/metodos/Gold/${chave}`]).toBe(dia);
      expect(updates[0].mudancas[`${chave}/Gold`]).toBe(dia);
    }

    // 0, negativo, acima de 31 e null caem todos em "apaga a chave" — e não em
    // gravar um dia impossível, que depois faria a fatura vencer em lado nenhum.
    for (const dia of [0, -1, 32, 99, null]) {
      updates = [];
      await s[fn](UID, cfgAtual, "Gold", dia);
      expect(updates[0].mudancas[`instituicoes/Gold/metodos/Gold/${chave}`]).toBeNull();
      expect(updates[0].mudancas[`${chave}/Gold`]).toBeNull();
    }
  });

  test("conta ainda por migrar grava a árvore inteira já com o dia dentro", async () => {
    await s.definirDiaFechamentoFatura(UID, porMigrar(["Conta", "Gold"]), "Gold", 28);

    expect(updates[0].mudancas.instituicoes).toEqual({
      Conta: { nome: "Conta", metodos: { Conta: { tipo: "debito" } } },
      Gold: { nome: "Gold", metodos: { Gold: { tipo: "debito", diaFechamentoFatura: 28 } } },
    });
    expect(updates[0].mudancas["diaFechamentoFatura/Gold"]).toBe(28);
  });

  test("id desconhecido só mexe no campo antigo, sem inventar um ramo", async () => {
    await s.definirDiaVencimentoFatura(UID, migrada(instituicao("Conta")), "Sumiu", 5);

    expect(updates[0].mudancas).toEqual({ "diaVencimentoFatura/Sumiu": 5 });
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
