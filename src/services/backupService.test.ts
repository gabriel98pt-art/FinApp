// Backup completo da conta. Estava a 0%, e é o serviço com a maior
// consequência de todos: `importarBackup` SOBRESCREVE a árvore inteira do
// utilizador. Um ficheiro estranho que passe pela validação apaga tudo o que
// a pessoa tem, e não há segundo backup para recuperar dali.
//
// Por isso o que se testa aqui, sobretudo, é o que NÃO deve passar: JSON
// inválido, JSON válido com a forma errada, e o `null` que se lê como objecto
// em JavaScript.

import { beforeEach, describe, expect, test, vi } from "vitest";

let sets: { caminho: string; valor: unknown }[] = [];
let valorLido: unknown = null;

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  get: async (r: { caminho: string }) => ({ val: () => valorLido, caminho: r.caminho }),
  set: async (r: { caminho: string }, valor: unknown) => {
    sets.push({ caminho: r.caminho, valor });
  },
  push: () => ({ caminho: "", key: "k1" }),
  remove: async () => {},
  update: async () => {},
  onValue: () => () => {},
}));

const s = await import("./backupService");

const UID = "u1";
const RAIZ = `users/${UID}/fin_v5`;

beforeEach(() => {
  sets = [];
  valorLido = null;
});

describe("exportarBackup", () => {
  test("embrulha os dados com versão e data", async () => {
    valorLido = { cfg: { currency: "EUR" } };
    const arquivo = JSON.parse(await s.exportarBackup(UID));

    expect(arquivo.versao).toBe(1);
    expect(arquivo.dados).toEqual({ cfg: { currency: "EUR" } });
    // A data serve para quem tem cinco ficheiros na pasta saber qual é o mais
    // recente sem os abrir.
    expect(new Date(arquivo.exportadoEm).getTime()).not.toBeNaN();
  });

  test("conta vazia exporta um objecto, não null", async () => {
    // O RTDB devolve null quando não há nada. Guardar `dados: null` faria a
    // importação seguinte falhar na validação — um backup que não se restaura.
    valorLido = null;
    const arquivo = JSON.parse(await s.exportarBackup(UID));
    expect(arquivo.dados).toEqual({});
  });

  test("sai indentado, para ser legível por um humano", async () => {
    valorLido = { cfg: {} };
    expect(await s.exportarBackup(UID)).toContain("\n");
  });
});

describe("importarBackup: o que tem de ser recusado", () => {
  test("texto que não é JSON", async () => {
    await expect(s.importarBackup(UID, "isto não é json")).rejects.toThrow(/não é um JSON válido/);
    expect(sets).toHaveLength(0);
  });

  test("ficheiro vazio", async () => {
    await expect(s.importarBackup(UID, "")).rejects.toThrow(/não é um JSON válido/);
    expect(sets).toHaveLength(0);
  });

  test("JSON válido mas sem a chave `dados`", async () => {
    await expect(s.importarBackup(UID, JSON.stringify({ versao: 1 }))).rejects.toThrow(
      /Formato de backup não reconhecido/,
    );
    expect(sets).toHaveLength(0);
  });

  test("`dados` que não é objecto (número, texto, booleano)", async () => {
    for (const dados of [42, "texto", true]) {
      await expect(s.importarBackup(UID, JSON.stringify({ dados }))).rejects.toThrow(
        /Formato de backup não reconhecido/,
      );
    }
    expect(sets).toHaveLength(0);
  });

  test("JSON que é só `null`", async () => {
    // `typeof null === "object"` em JavaScript: sem a checagem de veracidade
    // antes, este passava a validação e apagava a conta inteira.
    await expect(s.importarBackup(UID, "null")).rejects.toThrow(
      /Formato de backup não reconhecido/,
    );
    expect(sets).toHaveLength(0);
  });

  test("`dados: null` também é recusado", async () => {
    await expect(s.importarBackup(UID, JSON.stringify({ dados: null }))).rejects.toThrow(
      /Formato de backup não reconhecido/,
    );
    expect(sets).toHaveLength(0);
  });

  test("nenhuma recusa chega a escrever seja o que for", async () => {
    // O ponto de todos os testes acima, dito uma vez: recusar tarde, depois de
    // já ter escrito metade, seria pior do que não validar nada.
    for (const mau of ["", "{", "null", '{"versao":1}', '{"dados":5}']) {
      await s.importarBackup(UID, mau).catch(() => {});
    }
    expect(sets).toHaveLength(0);
  });
});

describe("importarBackup: o que passa", () => {
  test("um backup bem formado sobrescreve a raiz da conta", async () => {
    const backup = JSON.stringify({
      versao: 1,
      exportadoEm: "2026-08-12T10:00:00.000Z",
      dados: { cfg: { currency: "EUR" }, receitas: { r1: { descricao: "Salário" } } },
    });

    await s.importarBackup(UID, backup);

    expect(sets).toEqual([
      {
        caminho: RAIZ,
        valor: { cfg: { currency: "EUR" }, receitas: { r1: { descricao: "Salário" } } },
      },
    ]);
  });

  test("escreve na raiz da conta, e só nela", async () => {
    // Um caminho errado aqui espalharia os dados de uma conta por cima de
    // outra. O uid tem de estar no caminho.
    await s.importarBackup(UID, JSON.stringify({ dados: {} }));
    expect(sets[0].caminho).toBe(RAIZ);
    expect(sets[0].caminho).toContain(UID);
  });

  test("backup vazio é aceite — é o modo de limpar a conta", async () => {
    await s.importarBackup(UID, JSON.stringify({ dados: {} }));
    expect(sets[0].valor).toEqual({});
  });

  test("o que sai de exportarBackup entra em importarBackup", async () => {
    // O par tem de fechar: um ficheiro exportado hoje tem de ser restaurável
    // amanhã, sem passos manuais pelo meio.
    valorLido = { cfg: { currency: "BRL" }, parcelas: { p1: { descricao: "TV" } } };
    const arquivo = await s.exportarBackup(UID);

    await s.importarBackup(UID, arquivo);

    expect(sets[0].valor).toEqual(valorLido);
  });
});
