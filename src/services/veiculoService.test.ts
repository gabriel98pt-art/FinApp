// Gravação do veículo (4 sub-coleções sob veiculo/), com o firebase/database
// trocado por um duplo em memória — mesmo padrão de syncService.test.ts.
// O que mais interessa aqui é cada sub-coleção ir para o SEU caminho: um
// engano entre `despesas` e `despesasFixas` faz uma despesa pontual virar
// mensal para sempre.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Abastecimento } from "../types";

let dados: Record<string, unknown> = {};
let contador = 0;
/** caminho → callback de sucesso do onValue, para disparar leituras à mão. */
const observadores = new Map<string, (snap: { val: () => unknown }) => void>();

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
    dados[r.caminho] = valor;
  },
  remove: async (r: { caminho: string }) => {
    delete dados[r.caminho];
  },
  update: async (r: { caminho: string }, mudancas: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null) delete dados[`${r.caminho}/${k}`];
      else dados[`${r.caminho}/${k}`] = v;
    }
  },
  onValue: (r: { caminho: string }, sucesso: (snap: { val: () => unknown }) => void) => {
    observadores.set(r.caminho, sucesso);
    return () => observadores.delete(r.caminho);
  },
  get: async () => ({ val: () => null }),
}));

const s = await import("./veiculoService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5/veiculo`;

const carga: Omit<Abastecimento, "id"> = {
  data: "2026-08-01",
  kwh: 32,
  precoKwh: 18,
  custo: 576,
  local: "Casa",
};

beforeEach(() => {
  dados = {};
  contador = 0;
  observadores.clear();
  snapshot.mockClear();
});

describe("criar", () => {
  test("cada sub-coleção vai para o seu caminho", async () => {
    await s.criarCarga(UID, carga);
    await s.criarDespesaVeiculo(UID, {
      data: "2026-08-02",
      valor: 8000,
      categoria: "Manutenção",
    });
    await s.criarFixaVeiculo(UID, {
      descricao: "Seguro",
      valor: 4500,
      categoria: "Seguro",
      pagoPorMes: {},
    });
    await s.criarKm(UID, { data: "2026-08-03", km: 41230 });

    expect(Object.keys(dados).sort()).toEqual([
      `${RAIZ}/cargas/k1`,
      `${RAIZ}/despesas/k2`,
      `${RAIZ}/despesasFixas/k3`,
      `${RAIZ}/quilometragem/k4`,
    ]);
  });

  test("devolve o id novo e grava os dados", async () => {
    const id = await s.criarCarga(UID, carga);
    expect(id).toBe("k1");
    expect(dados[`${RAIZ}/cargas/k1`]).toEqual(carga);
  });

  test("campos opcionais vazios não são gravados", async () => {
    await s.criarCarga(UID, { ...carga, contaCartao: undefined, nota: undefined });
    expect(dados[`${RAIZ}/cargas/k1`]).toEqual(carga);
  });

  test("passa pelo histórico", async () => {
    await s.criarKm(UID, { data: "2026-08-03", km: 41230 });
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("atualizar", () => {
  test("reescreve o mesmo id em vez de criar outro", async () => {
    const id = await s.criarCarga(UID, carga);
    await s.atualizarCarga(UID, { ...carga, id, kwh: 40 });
    expect(Object.keys(dados)).toEqual([`${RAIZ}/cargas/${id}`]);
    expect(dados[`${RAIZ}/cargas/${id}`]).toEqual({ ...carga, kwh: 40 });
  });

  test("o id não vai dentro do valor", async () => {
    await s.atualizarKm(UID, { id: "abc", data: "2026-08-03", km: 41230 });
    expect(dados[`${RAIZ}/quilometragem/abc`]).toEqual({ data: "2026-08-03", km: 41230 });
  });

  test("passa pelo histórico", async () => {
    await s.atualizarCarga(UID, { ...carga, id: "abc" });
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("remover", () => {
  test("apaga só aquele id da sub-coleção certa", async () => {
    const a = await s.criarCarga(UID, carga);
    const b = await s.criarCarga(UID, carga);
    await s.removerCarga(UID, a);
    expect(Object.keys(dados)).toEqual([`${RAIZ}/cargas/${b}`]);
  });

  test("passa pelo histórico", async () => {
    await s.removerDespesaVeiculo(UID, "abc");
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("alternarPagoFixaVeiculo", () => {
  test("marcar grava true, desmarcar remove o mês", async () => {
    await s.alternarPagoFixaVeiculo(UID, "f1", "2026-08", true);
    expect(dados[`${RAIZ}/despesasFixas/f1/pagoPorMes/2026-08`]).toBe(true);
    await s.alternarPagoFixaVeiculo(UID, "f1", "2026-08", false);
    expect(dados).toEqual({});
  });

  test("passa pelo histórico", async () => {
    await s.alternarPagoFixaVeiculo(UID, "f1", "2026-08", true);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("observarVeiculo", () => {
  /** Dispara as 4 sub-coleções de uma vez, cada uma com `snap.val()` vazio a
   *  não ser que `dados` diga o contrário — o "carregamento completo" que
   *  os testes abaixo partem de. */
  type SubDominioTeste = "cargas" | "despesas" | "despesasFixas" | "quilometragem";
  function completarCarga(dados: Partial<Record<SubDominioTeste, unknown>> = {}) {
    for (const sub of ["cargas", "despesas", "despesasFixas", "quilometragem"] as const) {
      observadores.get(`${RAIZ}/${sub}`)!({ val: () => dados[sub] ?? null });
    }
  }

  test("junta as 4 sub-coleções num DadosVeiculo só", () => {
    const recebidos: { cargas: unknown[]; quilometragem: unknown[] }[] = [];
    s.observarVeiculo(
      UID,
      (d) => recebidos.push(d),
      () => {},
    );

    completarCarga({
      cargas: { c1: carga },
      quilometragem: { q1: { data: "2026-08-03", km: 41230 } },
    });

    const ultimo = recebidos[recebidos.length - 1];
    expect(ultimo.cargas).toEqual([{ ...carga, id: "c1" }]);
    expect(ultimo.quilometragem).toEqual([{ id: "q1", data: "2026-08-03", km: 41230 }]);
  });

  test("fixa sem pagoPorMes vem com mapa vazio — nunca undefined para a tela", () => {
    let ultimo: { despesasFixas: { pagoPorMes: unknown }[] } | null = null;
    s.observarVeiculo(
      UID,
      (d) => (ultimo = d),
      () => {},
    );
    completarCarga({
      despesasFixas: { f1: { descricao: "Seguro", valor: 4500, categoria: "Seguro" } },
    });
    expect(ultimo!.despesasFixas[0].pagoPorMes).toEqual({});
  });

  // Achado da auditoria de Arquitetura: syncService.ts marca "carregado" na
  // primeira vez que cb() dispara — com só 1 das 4 sub-coleções respondida,
  // isso era um DadosVeiculo pela metade sendo tratado como o definitivo.
  describe("cb() só dispara depois das 4 sub-coleções responderem (achado da auditoria)", () => {
    test("responder só 1, 2 ou 3 das 4 não chama cb() nenhuma vez", () => {
      const recebidos: unknown[] = [];
      s.observarVeiculo(
        UID,
        (d) => recebidos.push(d),
        () => {},
      );

      observadores.get(`${RAIZ}/cargas`)!({ val: () => null });
      expect(recebidos).toHaveLength(0);
      observadores.get(`${RAIZ}/despesas`)!({ val: () => null });
      expect(recebidos).toHaveLength(0);
      observadores.get(`${RAIZ}/despesasFixas`)!({ val: () => null });
      expect(recebidos).toHaveLength(0);
    });

    test("a 4ª resposta completa a carga e chama cb() pela primeira vez", () => {
      const recebidos: unknown[] = [];
      s.observarVeiculo(
        UID,
        (d) => recebidos.push(d),
        () => {},
      );

      observadores.get(`${RAIZ}/cargas`)!({ val: () => null });
      observadores.get(`${RAIZ}/despesas`)!({ val: () => null });
      observadores.get(`${RAIZ}/despesasFixas`)!({ val: () => null });
      expect(recebidos).toHaveLength(0);

      observadores.get(`${RAIZ}/quilometragem`)!({ val: () => null });
      expect(recebidos).toHaveLength(1);
    });

    test("ordem de resposta não importa — a última das 4, seja qual for, completa a carga", () => {
      const recebidos: unknown[] = [];
      s.observarVeiculo(
        UID,
        (d) => recebidos.push(d),
        () => {},
      );

      // Desta vez "cargas" é a ÚLTIMA a responder, não a primeira.
      observadores.get(`${RAIZ}/quilometragem`)!({ val: () => null });
      observadores.get(`${RAIZ}/despesasFixas`)!({ val: () => null });
      observadores.get(`${RAIZ}/despesas`)!({ val: () => null });
      expect(recebidos).toHaveLength(0);
      observadores.get(`${RAIZ}/cargas`)!({ val: () => null });
      expect(recebidos).toHaveLength(1);
    });

    test("depois da carga inicial completa, qualquer uma das 4 mudando sozinha dispara cb() na hora", () => {
      const recebidos: { cargas: unknown[] }[] = [];
      s.observarVeiculo(
        UID,
        (d) => recebidos.push(d),
        () => {},
      );
      completarCarga();
      expect(recebidos).toHaveLength(1);

      // Só "cargas" muda depois — não precisa esperar as outras 3 de novo.
      observadores.get(`${RAIZ}/cargas`)!({ val: () => ({ c1: carga }) });
      expect(recebidos).toHaveLength(2);
      expect(recebidos[1].cargas).toEqual([{ ...carga, id: "c1" }]);
    });
  });

  test("cancelar desliga as 4 subscrições", () => {
    const parar = s.observarVeiculo(
      UID,
      () => {},
      () => {},
    );
    expect(observadores.size).toBe(4);
    parar();
    expect(observadores.size).toBe(0);
  });
});
