// @vitest-environment jsdom

// P0 de 26/08: uma conta real ficou com o app a rebentar desde o arranque,
// em toda tela, mesmo depois de "limpar dados do site" e mesmo em Safari
// direto (não só no atalho instalado) — não era dado malformado no Firebase,
// era o espelho em `localStorage` (existe pra abrir rápido antes do Firebase
// responder, seção 6.1) gravado numa versão mais antiga do app, sem um campo
// que só passou a existir depois. O merge por omissão do zustand/persist é
// raso: troca o objeto `dados`/`cfg` inteiro pelo persistido, e o campo novo
// fica `undefined` até a primeira sincronização real — tempo suficiente pra
// quem lê esse campo sem esperar um array (`[...x]`, `for...of`) rebentar.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mesmo polyfill de `persistenciaAdiada.test.ts`: este projeto testa jsdom
// sem `localStorage` de verdade, e `persistenciaAdiada.ts` decide se tem
// storage UMA vez, já na importação do módulo — por isso o stub tem de
// existir ANTES do import, com `vi.resetModules()` para reavaliar a cada
// teste.
function localStorageEmMemoria(): Storage {
  const dados = new Map<string, string>();
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => {
      dados.set(chave, valor);
    },
    removeItem: (chave) => {
      dados.delete(chave);
    },
    clear: () => dados.clear(),
    key: () => null,
    get length() {
      return dados.size;
    },
  };
}

let mockLocalStorage: Storage;
const CHAVE = "finapp-teste-espelho";

beforeEach(() => {
  mockLocalStorage = localStorageEmMemoria();
  vi.stubGlobal("localStorage", mockLocalStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("criarStoreEspelho — rehidratação de um espelho mais antigo", () => {
  test("campo ausente no persistido cai no default, não em undefined", async () => {
    // Simula o que "conta real, versão antiga" deixou gravado: `dados` já
    // existia, mas sem o campo `bNovo` — que só entrou no tipo depois.
    mockLocalStorage.setItem(
      CHAVE,
      JSON.stringify({ state: { dados: { aAntigo: ["x"] } }, version: 0 }),
    );
    const { criarStoreEspelho } = await import("./storeEspelho");

    const useStore = criarStoreEspelho<{
      dados: { aAntigo: string[]; bNovo: string[] };
      carregado: boolean;
      erro: boolean;
    }>(CHAVE, { dados: { aAntigo: [], bNovo: [] }, carregado: false, erro: false });

    await useStore.persist.rehydrate();

    // O campo antigo, que a conta real tinha, sobrevive à rehidratação —
    // isto não pode virar "ignora tudo o que está persistido".
    expect(useStore.getState().dados.aAntigo).toEqual(["x"]);
    // O campo novo, ausente no que a conta real tinha gravado, cai no
    // default — não fica `undefined` esperando a próxima sincronização.
    expect(useStore.getState().dados.bNovo).toEqual([]);
  });

  test("campo de array no nível de cima também não quebra (merge raso já bastava)", async () => {
    mockLocalStorage.setItem(
      CHAVE,
      JSON.stringify({ state: { itens: [{ id: "1" }] }, version: 0 }),
    );
    const { criarStoreEspelho } = await import("./storeEspelho");

    const useStore = criarStoreEspelho<{
      itens: { id: string }[];
      carregado: boolean;
      erro: boolean;
    }>(CHAVE, { itens: [], carregado: false, erro: false });

    await useStore.persist.rehydrate();

    expect(useStore.getState().itens).toEqual([{ id: "1" }]);
  });

  test("nada persistido ainda: fica no estado inicial, sem lançar", async () => {
    const { criarStoreEspelho } = await import("./storeEspelho");

    const useStore = criarStoreEspelho<{
      dados: { bNovo: string[] };
      carregado: boolean;
      erro: boolean;
    }>(CHAVE, { dados: { bNovo: [] }, carregado: false, erro: false });

    await useStore.persist.rehydrate();

    expect(useStore.getState().dados.bNovo).toEqual([]);
  });
});
