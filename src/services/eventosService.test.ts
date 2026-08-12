// Eventos do calendário. Mesmo padrão de dobra em memória dos outros
// serviços.
//
// É o serviço mais simples do app — três funções de CRUD —, e é essa a razão
// de o testar: o que se protege aqui não é lógica, é o CONTRATO. O caminho
// onde grava, o mapa-para-lista que o RTDB obriga, e o id que vem da chave.
// Mexer num destes três parte o Calendário inteiro sem partir mais nada.

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { EventoCalendario } from "../types";

let sets: { caminho: string; valor: unknown }[] = [];
let removes: string[] = [];
let contador = 0;
let valorObservado: unknown = null;
let cancelado = false;

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
  },
  remove: async (r: { caminho: string }) => {
    removes.push(r.caminho);
  },
  update: async () => {},
  onValue: (_r: unknown, cb: (snap: { val: () => unknown }) => void) => {
    cb({ val: () => valorObservado });
    return () => {
      cancelado = true;
    };
  },
  get: async () => ({ val: () => null }),
}));

const s = await import("./eventosService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5/eventos`;

beforeEach(() => {
  sets = [];
  removes = [];
  contador = 0;
  valorObservado = null;
  cancelado = false;
  snapshot.mockClear();
});

describe("observarEventos", () => {
  test("conta nova (nó inexistente) devolve lista vazia, não null", () => {
    const recebidos: EventoCalendario[][] = [];
    s.observarEventos(
      UID,
      (e) => recebidos.push(e),
      () => {},
    );
    expect(recebidos[0]).toEqual([]);
  });

  test("o id de cada evento vem da chave do RTDB, não do corpo", () => {
    // O corpo guardado não tem `id` — ele é a chave. Se isto se perdesse, o
    // Calendário não conseguia apagar um evento (não sabia qual).
    valorObservado = { e1: { titulo: "Dentista", data: "2026-08-20" } };
    const recebidos: EventoCalendario[][] = [];
    s.observarEventos(
      UID,
      (e) => recebidos.push(e),
      () => {},
    );

    expect(recebidos[0]).toEqual([{ id: "e1", titulo: "Dentista", data: "2026-08-20" }]);
  });

  test("devolve a função que corta a subscrição", () => {
    const parar = s.observarEventos(
      UID,
      () => {},
      () => {},
    );
    parar();
    expect(cancelado).toBe(true);
  });
});

describe("criarEvento", () => {
  test("grava sob chave nova no caminho dos eventos e devolve o id", async () => {
    const id = await s.criarEvento(UID, {
      titulo: "Dentista",
      data: "2026-08-20",
    } as Omit<EventoCalendario, "id">);

    expect(id).toBe("k1");
    expect(sets[0].caminho).toBe(`${RAIZ}/k1`);
    expect(sets[0].valor).toEqual({ titulo: "Dentista", data: "2026-08-20" });
  });

  test("campos indefinidos são limpos antes de escrever", async () => {
    // O RTDB rejeita `undefined` — a nota opcional vazia rebentava a gravação.
    await s.criarEvento(UID, {
      titulo: "Dentista",
      data: "2026-08-20",
      nota: undefined,
    } as unknown as Omit<EventoCalendario, "id">);

    expect(sets[0].valor).toEqual({ titulo: "Dentista", data: "2026-08-20" });
  });

  test("guarda um ponto no histórico", async () => {
    await s.criarEvento(UID, { titulo: "X", data: "2026-08-20" } as Omit<EventoCalendario, "id">);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});

describe("removerEvento", () => {
  test("apaga pelo id, e só esse", async () => {
    await s.removerEvento(UID, "e1");
    expect(removes).toEqual([`${RAIZ}/e1`]);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
