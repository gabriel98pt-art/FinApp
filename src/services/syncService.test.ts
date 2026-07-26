// Fiação entre as subscrições do RTDB e as stores, com o firebase/database
// trocado por um duplo que guarda os dois callbacks de cada onValue — assim
// dá pra disparar sucesso e erro à mão, que é o que nunca se consegue
// reproduzir contra o Firebase real.

import { beforeEach, describe, expect, test, vi } from "vitest";

type Sucesso = (snap: { val: () => unknown }) => void;
type Falha = (erro: Error) => void;

/** caminho no RTDB → callbacks registados por onValue. */
const observadores = new Map<string, { sucesso: Sucesso; erro?: Falha }>();

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  onValue: (r: { caminho: string }, sucesso: Sucesso, erro?: Falha) => {
    observadores.set(r.caminho, { sucesso, erro });
    return () => observadores.delete(r.caminho);
  },
  push: () => ({ key: "novo" }),
  set: async () => {},
  update: async () => {},
  remove: async () => {},
  get: async () => ({ val: () => null }),
}));

const { iniciarSyncConta } = await import("./syncService");
const { useReceitasStore, useDespesasFixasStore } = await import("../stores/lancamentosStore");
const { useCfgStore } = await import("../stores/cfgStore");
const { useVeiculoStore } = await import("../stores/veiculoStore");

const UID = "u1";
const P = {
  receitas: `users/${UID}/fin_v5/receitas`,
  despesasFixas: `users/${UID}/fin_v5/despesasFixas`,
  cfg: `users/${UID}/fin_v5/cfg`,
  cargas: `users/${UID}/fin_v5/veiculo/cargas`,
};

/** Dispara o callback de sucesso daquele caminho com um valor cru do RTDB. */
function emitir(caminho: string, valor: unknown) {
  observadores.get(caminho)!.sucesso({ val: () => valor });
}

/** Dispara o cancelCallback — o que o Firebase chama quando a regra recusa a
 *  leitura ou a subscrição cai. */
function falhar(caminho: string) {
  observadores.get(caminho)!.erro!(new Error("PERMISSION_DENIED"));
}

let limpar: () => void;

beforeEach(() => {
  observadores.clear();
  limpar = iniciarSyncConta(UID);
});

describe("cada subscrição regista um cancelCallback", () => {
  test("os 10 domínios passam o terceiro argumento do onValue", () => {
    // Sem isto uma falha de rede/regra nunca chega à app: era o bug 4.1.
    expect(observadores.size).toBeGreaterThanOrEqual(10);
    for (const [caminho, { erro }] of observadores) {
      expect(typeof erro, caminho).toBe("function");
    }
  });
});

describe("erro para de esperar sem se disfarçar de 'sem dados'", () => {
  test("marca erro e carregado, e NÃO chama o callback de sucesso", () => {
    falhar(P.receitas);
    const s = useReceitasStore.getState();
    expect(s.erro).toBe(true);
    // carregado true é o ponto: sem isto a tela fica em "Carregando…" pra sempre
    expect(s.carregado).toBe(true);
    expect(s.itens).toEqual([]);
  });

  test("dados já carregados sobrevivem ao erro — só param de ser atualizados", () => {
    emitir(P.receitas, { r1: { descricao: "Salário", valor: 200000, data: "2026-07-01" } });
    expect(useReceitasStore.getState().itens).toHaveLength(1);

    falhar(P.receitas);
    const s = useReceitasStore.getState();
    expect(s.erro).toBe(true);
    expect(s.itens).toHaveLength(1);
    expect(s.itens[0].descricao).toBe("Salário");
  });

  test("sucesso depois do erro limpa o aviso (a ligação voltou sozinha)", () => {
    falhar(P.receitas);
    expect(useReceitasStore.getState().erro).toBe(true);

    emitir(P.receitas, { r1: { descricao: "Extra", valor: 5000, data: "2026-07-02" } });
    const s = useReceitasStore.getState();
    expect(s.erro).toBe(false);
    expect(s.carregado).toBe(true);
    expect(s.itens).toHaveLength(1);
  });

  test("o erro de um domínio não contamina os outros", () => {
    falhar(P.receitas);
    expect(useReceitasStore.getState().erro).toBe(true);
    expect(useCfgStore.getState().erro).toBe(false);
    expect(useDespesasFixasStore.getState().erro).toBe(false);
  });

  test("cfg falhando é o que acende a faixa global", () => {
    expect(useCfgStore.getState().erro).toBe(false);
    falhar(P.cfg);
    expect(useCfgStore.getState().erro).toBe(true);
    expect(useCfgStore.getState().carregado).toBe(true);
  });

  test("veículo: basta UMA das 4 sub-coleções cair", () => {
    falhar(P.cargas);
    expect(useVeiculoStore.getState().erro).toBe(true);
    expect(useVeiculoStore.getState().carregado).toBe(true);
  });
});

test("o sucesso repõe pagoPorMes que o RTDB omite quando está vazio", () => {
  emitir(P.despesasFixas, { f1: { descricao: "Aluguel", valor: 45000, categoria: "Casa" } });
  expect(useDespesasFixasStore.getState().itens[0].pagoPorMes).toEqual({});
});

test("logout limpa dados e também o erro da subscrição que morreu", () => {
  emitir(P.receitas, { r1: { descricao: "Salário", valor: 200000, data: "2026-07-01" } });
  falhar(P.cfg);

  limpar();

  expect(useReceitasStore.getState().itens).toEqual([]);
  expect(useReceitasStore.getState().carregado).toBe(false);
  expect(useCfgStore.getState().erro).toBe(false);
  expect(useCfgStore.getState().carregado).toBe(false);
});
