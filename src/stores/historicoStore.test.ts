// A store de undo/redo não tinha teste nenhum (mesmo achado de
// historicoService.test.ts: 9% de cobertura, a operação mais destrutiva do
// app). O que se protege aqui é a orquestração: sem uid não faz nada (não
// vaza undo/redo de uma conta pra outra — seção 4.9), pilha vazia não chama
// o Firebase à toa, e falha na escrita mostra o aviso certo sem deixar a
// pilha incoerente com o que está de facto salvo.

import { beforeEach, describe, expect, test, vi } from "vitest";

let proximoEstado = 0;
const capturarEstadoAtual = vi.fn(() => `estado${proximoEstado++}`);
const restaurarEstado = vi.fn(async () => {});
const mostrarToast = vi.fn();

vi.mock("../services/historicoService", () => ({
  capturarEstadoAtual: (...a: unknown[]) => capturarEstadoAtual(...(a as [])),
  restaurarEstado: (...a: unknown[]) => restaurarEstado(...(a as [])),
}));
vi.mock("./toastStore", () => ({ mostrarToast: (...a: unknown[]) => mostrarToast(...(a as [])) }));

const { useHistoricoStore, snapshotHistorico } = await import("./historicoStore");

beforeEach(() => {
  proximoEstado = 0;
  capturarEstadoAtual.mockClear();
  restaurarEstado.mockClear();
  mostrarToast.mockClear();
  useHistoricoStore.setState({ uid: null, pilha: { pilha: [], indice: -1 } });
});

describe("iniciar / parar — seção 4.9, nunca vazar entre contas", () => {
  test("iniciar liga o uid e começa com pilha vazia", () => {
    useHistoricoStore.getState().iniciar("u1");
    expect(useHistoricoStore.getState().uid).toBe("u1");
    expect(useHistoricoStore.getState().pilha).toEqual({ pilha: [], indice: -1 });
  });

  test("trocar de conta (novo iniciar) zera a pilha da conta anterior", () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();
    expect(useHistoricoStore.getState().pilha.pilha).toHaveLength(1);

    useHistoricoStore.getState().iniciar("u2");
    expect(useHistoricoStore.getState().pilha).toEqual({ pilha: [], indice: -1 });
  });

  test("parar desliga o uid e zera a pilha", () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();

    useHistoricoStore.getState().parar();

    expect(useHistoricoStore.getState().uid).toBeNull();
    expect(useHistoricoStore.getState().pilha).toEqual({ pilha: [], indice: -1 });
  });
});

describe("snapshot", () => {
  test("sem uid não captura nada — não há onde contar o histórico", () => {
    useHistoricoStore.getState().snapshot();

    expect(capturarEstadoAtual).not.toHaveBeenCalled();
    expect(useHistoricoStore.getState().pilha.pilha).toHaveLength(0);
  });

  test("com uid, empilha o estado capturado", () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();

    expect(capturarEstadoAtual).toHaveBeenCalledTimes(1);
    expect(useHistoricoStore.getState().pilha.pilha).toEqual(["estado0"]);
  });

  test("snapshotHistorico() (função livre) chama o mesmo snapshot da store", () => {
    useHistoricoStore.getState().iniciar("u1");
    snapshotHistorico();

    expect(useHistoricoStore.getState().pilha.pilha).toEqual(["estado0"]);
  });
});

describe("desfazer", () => {
  test("sem uid não faz nada", async () => {
    await useHistoricoStore.getState().desfazer();

    expect(restaurarEstado).not.toHaveBeenCalled();
    expect(mostrarToast).not.toHaveBeenCalled();
  });

  test("pilha vazia: não chama o Firebase, não mostra toast", async () => {
    useHistoricoStore.getState().iniciar("u1");

    await useHistoricoStore.getState().desfazer();

    expect(restaurarEstado).not.toHaveBeenCalled();
    expect(mostrarToast).not.toHaveBeenCalled();
  });

  test("com um snapshot na pilha: restaura na conta certa e avisa 'Desfeito'", async () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot(); // empilha "estado0"

    await useHistoricoStore.getState().desfazer();

    expect(restaurarEstado).toHaveBeenCalledWith("u1", "estado0");
    expect(mostrarToast).toHaveBeenCalledWith("↩ Desfeito");
  });

  test("falha ao restaurar: avisa erro, não a mensagem de sucesso", async () => {
    restaurarEstado.mockRejectedValueOnce(new Error("rede caiu"));
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();

    await useHistoricoStore.getState().desfazer();

    expect(mostrarToast).toHaveBeenCalledWith("Não foi possível desfazer.");
    expect(mostrarToast).not.toHaveBeenCalledWith("↩ Desfeito");
  });
});

describe("refazer", () => {
  test("sem uid não faz nada", async () => {
    await useHistoricoStore.getState().refazer();
    expect(restaurarEstado).not.toHaveBeenCalled();
  });

  test("sem um desfazer antes, não há nada a refazer", async () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();

    await useHistoricoStore.getState().refazer();

    expect(restaurarEstado).not.toHaveBeenCalled();
    expect(mostrarToast).not.toHaveBeenCalled();
  });

  test("desfazer seguido de refazer volta ao estado ao vivo e avisa 'Refeito'", async () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot(); // empilha "estado0"
    await useHistoricoStore.getState().desfazer(); // captura o "estado1" ao vivo, restaura "estado0"
    mostrarToast.mockClear();
    restaurarEstado.mockClear();

    await useHistoricoStore.getState().refazer();

    expect(restaurarEstado).toHaveBeenCalledWith("u1", "estado1");
    expect(mostrarToast).toHaveBeenCalledWith("↪ Refeito");
  });

  test("falha ao restaurar: avisa erro, não a mensagem de sucesso", async () => {
    useHistoricoStore.getState().iniciar("u1");
    useHistoricoStore.getState().snapshot();
    await useHistoricoStore.getState().desfazer();
    mostrarToast.mockClear();
    restaurarEstado.mockRejectedValueOnce(new Error("rede caiu"));

    await useHistoricoStore.getState().refazer();

    expect(mostrarToast).toHaveBeenCalledWith("Não foi possível refazer.");
  });
});
