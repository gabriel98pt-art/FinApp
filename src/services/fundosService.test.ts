// Fundos de poupança, com o firebase/database trocado por uma dobra em
// memória — mesmo padrão de parcelasService.test.ts.
//
// O que aqui importa é `contribuirFundo`: ele SOMA ao valor guardado em vez de
// o substituir. Trocar uma coisa pela outra não parte nada à vista — a tela
// mostra um número —, mas apaga tudo o que a pessoa já tinha poupado naquele
// fundo, e é irreversível assim que a próxima sincronização acontece.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Fundo } from "../types";

let dados: Record<string, unknown> = {};
let sets: { caminho: string; valor: unknown }[] = [];
let removes: string[] = [];
let contador = 0;
let valorObservado: unknown = null;
let erroObservado: ((e: Error) => void) | null = null;

vi.mock("./firebase", () => ({ db: {} }));

const snapshot = vi.fn();
vi.mock("../stores/historicoStore", () => ({ snapshotHistorico: () => snapshot() }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  push: (r: { caminho: string }) => {
    const key = `k${++contador}`;
    return { caminho: `${r.caminho}/${key}`, key };
  },
  set: async (r: { caminho: string }, valor: unknown) => {
    sets.push({ caminho: r.caminho, valor });
    dados[r.caminho] = valor;
  },
  remove: async (r: { caminho: string }) => {
    removes.push(r.caminho);
    delete dados[r.caminho];
  },
  update: async () => {},
  runTransaction: async (r: { caminho: string }, atualizar: (atual: unknown) => unknown) => {
    const novo = atualizar(dados[r.caminho] ?? null);
    sets.push({ caminho: r.caminho, valor: novo });
    dados[r.caminho] = novo;
    return { committed: true, snapshot: { val: () => novo } };
  },
  onValue: (
    _r: unknown,
    cb: (snap: { val: () => unknown }) => void,
    aoErro: (e: Error) => void,
  ) => {
    erroObservado = aoErro;
    cb({ val: () => valorObservado });
    return () => {};
  },
  get: async () => ({ val: () => null }),
}));

const s = await import("./fundosService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5/fundos`;

beforeEach(() => {
  dados = {};
  sets = [];
  removes = [];
  contador = 0;
  valorObservado = null;
  erroObservado = null;
  snapshot.mockClear();
});

describe("observarFundos", () => {
  test("sem nada guardado devolve lista vazia, não null", () => {
    // O RTDB devolve null quando o nó não existe. Sem esta conversão, a tela
    // de Metas tentava `.map` sobre null no primeiro arranque de uma conta.
    const recebidos: Fundo[][] = [];
    s.observarFundos(
      UID,
      (f) => recebidos.push(f),
      () => {},
    );
    expect(recebidos[0]).toEqual([]);
  });

  test("transforma o mapa do RTDB em lista, com o id vindo da chave", () => {
    valorObservado = {
      f1: { nome: "Viagem", atual: 5000, alvo: 200000 },
      f2: { nome: "Carro", atual: 0, alvo: 100000 },
    };
    const recebidos: Fundo[][] = [];
    s.observarFundos(
      UID,
      (f) => recebidos.push(f),
      () => {},
    );

    expect(recebidos[0]).toEqual([
      { id: "f1", nome: "Viagem", atual: 5000, alvo: 200000 },
      { id: "f2", nome: "Carro", atual: 0, alvo: 100000 },
    ]);
  });

  test("passa o erro adiante para quem subscreve marcar a queda", () => {
    s.observarFundos(
      UID,
      () => {},
      () => {},
    );
    expect(erroObservado).toBeInstanceOf(Function);
  });
});

describe("criarFundo", () => {
  test("grava sob uma chave nova e devolve o id", async () => {
    const id = await s.criarFundo(UID, { nome: "Viagem", atual: 0, alvo: 200000 });

    expect(id).toBe("k1");
    expect(sets).toEqual([
      { caminho: `${RAIZ}/k1`, valor: { nome: "Viagem", atual: 0, alvo: 200000 } },
    ]);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  test("campos indefinidos não chegam a ser gravados", async () => {
    // O RTDB rejeita `undefined`; `semIndefinidos` limpa antes de escrever.
    await s.criarFundo(UID, { nome: "Viagem", atual: 0, alvo: undefined } as unknown as Omit<
      Fundo,
      "id"
    >);
    expect(sets[0].valor).toEqual({ nome: "Viagem", atual: 0 });
  });
});

describe("removerFundo", () => {
  test("apaga só o fundo pedido", async () => {
    await s.removerFundo(UID, "f1");
    expect(removes).toEqual([`${RAIZ}/f1`]);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("contribuirFundo", () => {
  const fundo: Fundo = { id: "f1", nome: "Viagem", atual: 5000, alvo: 200000 };

  beforeEach(() => {
    // A transação lê o valor atual do servidor, não `fundo.atual` do
    // argumento — simula o que já está guardado em `dados`.
    dados[`${RAIZ}/f1/atual`] = fundo.atual;
  });

  test("SOMA ao que já lá estava, em vez de substituir", async () => {
    await s.contribuirFundo(UID, fundo, 2500);
    // 50,00 + 25,00 = 75,00. Se isto passasse a gravar só o valor novo, a
    // poupança acumulada desaparecia sem aviso nenhum.
    expect(sets).toEqual([{ caminho: `${RAIZ}/f1/atual`, valor: 7500 }]);
  });

  test("escreve só no campo `atual`, não no fundo inteiro", async () => {
    // Gravar o objecto todo apagaria o nome e o alvo se o chamador passasse
    // um fundo incompleto.
    await s.contribuirFundo(UID, fundo, 100);
    expect(sets[0].caminho).toBe(`${RAIZ}/f1/atual`);
  });

  test("contribuição negativa retira — é assim que se corrige um engano", async () => {
    await s.contribuirFundo(UID, fundo, -2000);
    expect(sets[0].valor).toBe(3000);
  });

  test("guarda um ponto no histórico antes de escrever", async () => {
    await s.contribuirFundo(UID, fundo, 100);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  test("duas contribuições quase simultâneas, a partir do mesmo snapshot antigo, não se apagam", async () => {
    // Duas abas (ou Planejamento e o Copiloto) carregam o mesmo `fundo` com
    // `atual: 5000` e contribuem quase ao mesmo tempo. Com um `set` simples
    // baseado nesse snapshot, a segunda escrita (5000 + 3000) apagaria a
    // primeira (5000 + 2500). A transação soma sobre o valor já gravado no
    // servidor, então as duas contribuições devem sobreviver.
    await Promise.all([s.contribuirFundo(UID, fundo, 2500), s.contribuirFundo(UID, fundo, 3000)]);
    expect(dados[`${RAIZ}/f1/atual`]).toBe(10500);
  });
});
