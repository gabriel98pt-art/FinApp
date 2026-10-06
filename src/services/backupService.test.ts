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
/** Leituras por caminho exato; o que não estiver aqui devolve `valorLido`. */
let leiturasPorCaminho: Record<string, unknown> = {};
/** Ordem de TODAS as operações (leituras e escritas), para provar a sequência. */
let operacoes: string[] = [];
/** Caminho cuja escrita deve falhar (simula rede a cair / permissão negada). */
let falharSetEm: string | null = null;

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("firebase/database", () => ({
  ref: (_db: unknown, caminho: string) => ({ caminho }),
  get: async (r: { caminho: string }) => {
    operacoes.push(`get ${r.caminho}`);
    const v = r.caminho in leiturasPorCaminho ? leiturasPorCaminho[r.caminho] : valorLido;
    return { val: () => v, caminho: r.caminho };
  },
  set: async (r: { caminho: string }, valor: unknown) => {
    operacoes.push(`set ${r.caminho}`);
    if (r.caminho === falharSetEm) throw new Error("PERMISSION_DENIED");
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

const SNAPSHOT = `users/${UID}/_seguranca/snapshotAntesRestauracao`;

beforeEach(() => {
  sets = [];
  valorLido = null;
  leiturasPorCaminho = {};
  operacoes = [];
  falharSetEm = null;
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

    // Desde a Fase 1 (cópia de segurança), a primeira escrita é o snapshot;
    // a da raiz da conta é a ÚLTIMA — e a única em `fin_v5`.
    expect(sets.filter((x) => x.caminho === RAIZ)).toEqual([
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
    expect(sets.at(-1)!.caminho).toBe(RAIZ);
    for (const escrita of sets) expect(escrita.caminho).toContain(`users/${UID}/`);
  });

  test("backup vazio é aceite — é o modo de limpar a conta", async () => {
    await s.importarBackup(UID, JSON.stringify({ dados: {} }));
    expect(sets.at(-1)!.valor).toEqual({});
  });

  test("o que sai de exportarBackup entra em importarBackup", async () => {
    // O par tem de fechar: um ficheiro exportado hoje tem de ser restaurável
    // amanhã, sem passos manuais pelo meio.
    valorLido = { cfg: { currency: "BRL" }, parcelas: { p1: { descricao: "TV" } } };
    const arquivo = await s.exportarBackup(UID);

    await s.importarBackup(UID, arquivo);

    expect(sets.at(-1)!.valor).toEqual(valorLido);
  });
});

describe("importarBackup: cópia de segurança antes de sobrescrever", () => {
  const BACKUP = JSON.stringify({
    versao: 1,
    exportadoEm: "2026-08-12T10:00:00.000Z",
    dados: { receitas: { r9: { descricao: "Do arquivo" } } },
  });

  test("lê o estado atual, grava o snapshot, e SÓ DEPOIS sobrescreve a conta", async () => {
    valorLido = { receitas: { r1: { descricao: "Atual" } } };

    await s.importarBackup(UID, BACKUP);

    expect(operacoes).toEqual([`get ${RAIZ}`, `set ${SNAPSHOT}`, `set ${RAIZ}`]);
  });

  test("o snapshot guarda os dados atuais, com data", async () => {
    valorLido = { cfg: { currency: "EUR" }, receitas: { r1: { descricao: "Atual" } } };

    await s.importarBackup(UID, BACKUP);

    const snap = sets.find((x) => x.caminho === SNAPSHOT)!.valor as {
      versao: number;
      criadoEm: string;
      dados: unknown;
    };
    expect(snap.versao).toBe(1);
    expect(snap.dados).toEqual(valorLido);
    expect(new Date(snap.criadoEm).getTime()).not.toBeNaN();
    // E a conta ficou com o conteúdo do arquivo, não com o antigo.
    expect(sets.at(-1)).toEqual({
      caminho: RAIZ,
      valor: { receitas: { r9: { descricao: "Do arquivo" } } },
    });
  });

  test("conta vazia: o snapshot guarda `{}`, não null", async () => {
    valorLido = null;
    await s.importarBackup(UID, BACKUP);
    expect((sets[0].valor as { dados: unknown }).dados).toEqual({});
  });

  test("se gravar o snapshot falhar, a conta NÃO é tocada", async () => {
    valorLido = { receitas: { r1: { descricao: "Atual" } } };
    falharSetEm = SNAPSHOT;

    await expect(s.importarBackup(UID, BACKUP)).rejects.toThrow(/cópia de segurança/);

    expect(operacoes).not.toContain(`set ${RAIZ}`);
    expect(sets).toHaveLength(0);
  });

  test("arquivo inválido não chega sequer a ler nem a gravar o snapshot", async () => {
    await s.importarBackup(UID, JSON.stringify({ versao: 2, dados: {} })).catch(() => {});
    await s.importarBackup(UID, JSON.stringify({ dados: { receitas: [] } })).catch(() => {});
    expect(operacoes).toEqual([]);
  });
});

describe("restaurarSnapshotDeSeguranca", () => {
  test("lê o slot de segurança e repõe os dados em fin_v5", async () => {
    leiturasPorCaminho[SNAPSHOT] = {
      versao: 1,
      criadoEm: "2026-10-01T10:00:00.000Z",
      dados: { receitas: { r1: { descricao: "Antes" } } },
    };

    await s.restaurarSnapshotDeSeguranca(UID);

    expect(operacoes).toEqual([`get ${SNAPSHOT}`, `set ${RAIZ}`]);
    expect(sets).toEqual([{ caminho: RAIZ, valor: { receitas: { r1: { descricao: "Antes" } } } }]);
  });

  test("não altera o próprio slot — dá para desfazer outra vez", async () => {
    leiturasPorCaminho[SNAPSHOT] = { versao: 1, criadoEm: "2026-10-01T10:00:00.000Z", dados: {} };
    await s.restaurarSnapshotDeSeguranca(UID);
    expect(sets.some((x) => x.caminho === SNAPSHOT)).toBe(false);
  });

  test("snapshot de conta vazia (RTDB descarta `dados: {}`) repõe a conta vazia", async () => {
    leiturasPorCaminho[SNAPSHOT] = { versao: 1, criadoEm: "2026-10-01T10:00:00.000Z" };
    await s.restaurarSnapshotDeSeguranca(UID);
    expect(sets).toEqual([{ caminho: RAIZ, valor: {} }]);
  });

  test("sem snapshot guardado: erro claro e nada escrito", async () => {
    leiturasPorCaminho[SNAPSHOT] = null;
    await expect(s.restaurarSnapshotDeSeguranca(UID)).rejects.toThrow(/Não há cópia de segurança/);
    expect(sets).toHaveLength(0);
  });

  test("snapshot com `dados` corrompido: recusa em vez de apagar a conta", async () => {
    leiturasPorCaminho[SNAPSHOT] = { versao: 1, criadoEm: "2026-10-01T10:00:00.000Z", dados: 5 };
    await expect(s.restaurarSnapshotDeSeguranca(UID)).rejects.toThrow(/corrompida/);
    expect(sets).toHaveLength(0);
  });

  test("ciclo completo: importar e depois desfazer devolve o estado original", async () => {
    const original = { receitas: { r1: { descricao: "Original" } } };
    valorLido = original;
    await s.importarBackup(UID, JSON.stringify({ versao: 1, dados: { receitas: {} } }));

    // O que foi gravado no slot passa a ser o que se lê dele.
    leiturasPorCaminho[SNAPSHOT] = sets.find((x) => x.caminho === SNAPSHOT)!.valor;
    sets = [];
    await s.restaurarSnapshotDeSeguranca(UID);

    expect(sets).toEqual([{ caminho: RAIZ, valor: original }]);
  });
});

describe("validarArquivoBackup", () => {
  const arquivo = (x: unknown) => JSON.stringify(x);

  test("aceita um backup completo e devolve o resumo", () => {
    const r = s.validarArquivoBackup(
      arquivo({
        versao: 1,
        exportadoEm: "2026-08-12T10:00:00.000Z",
        dados: {
          cfg: {
            categoriasDespesa: ["Casa", "Mercado", "Lazer"],
            instituicoes: { i1: { nome: "Banco A" }, i2: { nome: "Banco B" } },
            contasCartoes: ["m1", "m2", "m3", "m4"],
          },
          receitas: { r1: {}, r2: {} },
          despesasFixas: { f1: {} },
          despesasCorrentes: { c1: {}, c2: {}, c3: {} },
          parcelas: { p1: {} },
          eventos: { e1: {} },
          fundos: { u1: {} },
          transferencias: { t1: {} },
        },
      }),
    );

    expect(r).toEqual({
      ok: true,
      dados: expect.any(Object),
      resumo: {
        exportadoEm: "2026-08-12T10:00:00.000Z",
        // 2 receitas + 1 fixa + 3 correntes + 1 parcela — eventos, fundos e
        // transferências não são lançamentos.
        totalLancamentos: 7,
        // Instituições prevalecem sobre a lista antiga de contas/cartões.
        contas: 2,
        categorias: 3,
      },
    });
  });

  test("conta antiga sem `instituicoes` conta pelas contasCartoes", () => {
    const r = s.validarArquivoBackup(
      arquivo({ versao: 1, dados: { cfg: { contasCartoes: ["A", "B"] } } }),
    );
    expect(r.ok && r.resumo.contas).toBe(2);
  });

  test("sem cfg nem data: resumo com nulos, não inventa números", () => {
    const r = s.validarArquivoBackup(arquivo({ versao: 1, dados: {} }));
    expect(r).toEqual({
      ok: true,
      dados: {},
      resumo: { exportadoEm: null, totalLancamentos: 0, contas: null, categorias: null },
    });
  });

  test("sem `versao` é lido como versão 1 (formato de sempre)", () => {
    expect(s.validarArquivoBackup(arquivo({ dados: {} })).ok).toBe(true);
  });

  test("data inválida vira null em vez de 'Invalid Date' na tela", () => {
    const r = s.validarArquivoBackup(arquivo({ versao: 1, exportadoEm: "ontem", dados: {} }));
    expect(r.ok && r.resumo.exportadoEm).toBeNull();
  });

  test("recusa versão diferente de 1", () => {
    for (const versao of [2, 0, "1", null]) {
      const r = s.validarArquivoBackup(arquivo({ versao, dados: {} }));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.erro).toMatch(/Versão de backup não suportada/);
    }
  });

  test("recusa cada coleção que venha como array ou primitivo", () => {
    for (const colecao of [
      "receitas",
      "despesasFixas",
      "despesasCorrentes",
      "parcelas",
      "eventos",
      "fundos",
      "transferencias",
    ]) {
      for (const mau of [[{ descricao: "x" }], 5, "texto", true, null]) {
        const r = s.validarArquivoBackup(arquivo({ versao: 1, dados: { [colecao]: mau } }));
        expect(r.ok, `${colecao} = ${JSON.stringify(mau)}`).toBe(false);
        // A mensagem diz QUAL coleção — "Backup inválido" sozinho não ajuda.
        expect(!r.ok && r.erro).toContain(colecao);
      }
    }
  });

  test("recusa cfg que não seja objeto", () => {
    const r = s.validarArquivoBackup(arquivo({ versao: 1, dados: { cfg: [] } }));
    expect(r.ok).toBe(false);
  });

  test("recusa `dados` em forma de array", () => {
    const r = s.validarArquivoBackup(arquivo({ versao: 1, dados: [] }));
    expect(!r.ok && r.erro).toMatch(/Formato de backup não reconhecido/);
  });

  test("mantém as mensagens antigas para JSON inválido e sem `dados`", () => {
    const a = s.validarArquivoBackup("{");
    const b = s.validarArquivoBackup(arquivo({ versao: 1 }));
    expect(!a.ok && a.erro).toMatch(/não é um JSON válido/);
    expect(!b.ok && b.erro).toMatch(/Formato de backup não reconhecido/);
  });

  test("importarBackup lança exatamente o erro da validação", async () => {
    await expect(
      s.importarBackup(UID, arquivo({ versao: 1, dados: { parcelas: [] } })),
    ).rejects.toThrow(/parcelas/);
    expect(sets).toHaveLength(0);
  });
});
