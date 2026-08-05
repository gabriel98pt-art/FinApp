// Registo de erros, com o firebase/database trocado por um duplo em memória
// (mesmo padrão de syncService.test.ts). O que importa aqui é o caminho ficar
// FORA da árvore fin_v5, a lista não crescer para sempre, e uma falha de rede
// no registo nunca virar um segundo erro por cima do primeiro.

import { beforeEach, describe, expect, test, vi } from "vitest";

/** Conteúdo do nó erros_app, em memória. */
let no: Record<string, Record<string, unknown>> = {};
/** Caminhos por onde passou alguma escrita. */
let escritas: string[] = [];
let contador = 0;
/** Liga para o duplo do RTDB rejeitar as escritas. */
let semRede = false;

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  // As chaves do push() real são ordenáveis por ordem de criação — o zero à
  // esquerda mantém essa propriedade no duplo.
  push: () => ({ key: `e${String(++contador).padStart(3, "0")}` }),
  update: async (r: { caminho: string }, mudancas: Record<string, unknown>) => {
    if (semRede) throw new Error("PERMISSION_DENIED");
    escritas.push(r.caminho);
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null) delete no[k];
      else no[k] = v as Record<string, unknown>;
    }
  },
  get: async () => ({ val: () => (Object.keys(no).length ? no : null) }),
  remove: async (r: { caminho: string }) => {
    escritas.push(r.caminho);
    no = {};
  },
  onValue: (r: { caminho: string }, sucesso: (snap: { val: () => unknown }) => void) => {
    escritas.push(r.caminho);
    sucesso({ val: () => no });
    return () => {};
  },
}));

const { limparErros, observarErros, registrarErro } = await import("./erroService");

const UID = "u1";
const CAMINHO = `users/${UID}/erros_app`;

const erro = (mensagem: string, ts = 1_000) => ({
  mensagem,
  url: "https://finapp/definicoes",
  timestamp: ts,
});

beforeEach(() => {
  no = {};
  escritas = [];
  contador = 0;
  semRede = false;
});

describe("registrarErro", () => {
  test("grava fora da árvore fin_v5, que é sobrescrita por backup e undo", async () => {
    await registrarErro(UID, erro("boom"));
    expect(escritas).toContain(CAMINHO);
    expect(escritas.some((c) => c.includes("fin_v5"))).toBe(false);
  });

  test("guarda mensagem, url e timestamp", async () => {
    await registrarErro(UID, { ...erro("boom", 1234), pilha: "linha 1" });
    expect(Object.values(no)[0]).toEqual({
      mensagem: "boom",
      pilha: "linha 1",
      url: "https://finapp/definicoes",
      timestamp: 1234,
    });
  });

  test("sem pilha, a chave não vai — o RTDB rejeita undefined", async () => {
    await registrarErro(UID, erro("boom"));
    expect(Object.values(no)[0]).not.toHaveProperty("pilha");
  });

  test("mantém só os últimos 30, apagando os mais antigos", async () => {
    for (let i = 1; i <= 35; i++) await registrarErro(UID, erro(`erro ${i}`, i));
    expect(Object.keys(no)).toHaveLength(30);
    const mensagens = Object.values(no).map((r) => r.mensagem);
    expect(mensagens).toContain("erro 35");
    expect(mensagens).not.toContain("erro 1");
    expect(mensagens).not.toContain("erro 5");
    expect(mensagens).toContain("erro 6");
  });

  test("não lança se a gravação falhar — é o caminho de erro do app", async () => {
    semRede = true;
    await expect(registrarErro(UID, erro("boom"))).resolves.toBeUndefined();
  });
});

describe("observarErros", () => {
  test("lê do mesmo caminho e devolve do mais recente para o mais antigo", async () => {
    await registrarErro(UID, erro("antigo", 100));
    await registrarErro(UID, erro("recente", 900));

    const recebidos: { mensagem: string }[][] = [];
    observarErros(UID, (l) => recebidos.push(l));

    expect(escritas).toContain(CAMINHO);
    expect(recebidos[0].map((e) => e.mensagem)).toEqual(["recente", "antigo"]);
  });

  test("cada registo vem com o id da chave", async () => {
    await registrarErro(UID, erro("boom"));
    let lista: { id: string }[] = [];
    observarErros(UID, (l) => (lista = l));
    expect(lista[0].id).toBe("e001");
  });
});

describe("limparErros", () => {
  test("apaga tudo", async () => {
    await registrarErro(UID, erro("boom"));
    await limparErros(UID);
    expect(no).toEqual({});
    expect(escritas).toContain(CAMINHO);
  });
});
