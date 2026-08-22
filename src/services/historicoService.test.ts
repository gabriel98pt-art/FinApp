// historicoService.ts não tinha NENHUM teste antes deste arquivo (achado da
// auditoria de Arquitetura + Testes/QA — 9% de cobertura, é a operação mais
// destrutiva do app: `restaurarEstado` sobrescreve a conta inteira a cada
// desfazer/refazer). O que se protege aqui é exatamente o bug confirmado:
// `capturarEstadoAtual` não inclui `iaUso` (não tem store própria pra lê-lo
// sem ir à rede) — um `set()` na raiz apagaria essa cota a cada undo. A
// defesa é `restaurarEstado` usar `update()`, não `set()`: cada domínio
// capturado é substituído, o resto da árvore (iaUso incluído) fica intocado.

import { beforeEach, describe, expect, test, vi } from "vitest";

const atualizarNaRaiz = vi.fn<(r: unknown, dados: unknown) => Promise<void>>(async () => {});
const refChamado = vi.fn((_db: unknown, caminho: string) => ({ __caminho: caminho }));

vi.mock("firebase/database", () => ({
  ref: refChamado,
  update: (r: unknown, dados: unknown) => atualizarNaRaiz(r, dados),
}));
vi.mock("./firebase", () => ({ db: {} }));

let receitas: unknown[] = [];
let despesasCorrentes: unknown[] = [];
let parcelas: unknown[] = [];
let eventos: unknown[] = [];
let fundos: unknown[] = [];
let despesasFixas: unknown[] = [];
let transferencias: unknown[] = [];
let veiculo: Record<"cargas" | "despesas" | "despesasFixas" | "quilometragem", unknown[]> = {
  cargas: [],
  despesas: [],
  despesasFixas: [],
  quilometragem: [],
};
let cfg: unknown = { currency: "EUR" };
let tvde: unknown = { metaMensal: 0 };

vi.mock("../stores/cfgStore", () => ({ useCfgStore: { getState: () => ({ cfg }) } }));
vi.mock("../stores/eventosStore", () => ({
  useEventosStore: { getState: () => ({ itens: eventos }) },
}));
vi.mock("../stores/fundosStore", () => ({
  useFundosStore: { getState: () => ({ itens: fundos }) },
}));
vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: { getState: () => ({ itens: receitas }) },
  useDespesasStore: { getState: () => ({ itens: despesasCorrentes }) },
  useDespesasFixasStore: { getState: () => ({ itens: despesasFixas }) },
  useTransferenciasStore: { getState: () => ({ itens: transferencias }) },
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: { getState: () => ({ itens: parcelas }) },
}));
vi.mock("../stores/tvdeStore", () => ({ useTvdeStore: { getState: () => ({ dados: tvde }) } }));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: { getState: () => ({ dados: veiculo }) },
}));

const { capturarEstadoAtual, restaurarEstado } = await import("./historicoService");

beforeEach(() => {
  receitas = [];
  despesasCorrentes = [];
  parcelas = [];
  eventos = [];
  fundos = [];
  despesasFixas = [];
  transferencias = [];
  veiculo = { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] };
  cfg = { currency: "EUR" };
  tvde = { metaMensal: 0 };
  atualizarNaRaiz.mockClear();
  refChamado.mockClear();
});

describe("capturarEstadoAtual", () => {
  test("lista {id,...} vira mapa {id: {...sem id}}", () => {
    receitas = [{ id: "r1", valor: 100, descricao: "Salário" }];

    const arvore = JSON.parse(capturarEstadoAtual());

    expect(arvore.receitas).toEqual({ r1: { valor: 100, descricao: "Salário" } });
  });

  test("captura os 10 domínios com store própria", () => {
    const arvore = JSON.parse(capturarEstadoAtual());

    expect(Object.keys(arvore).sort()).toEqual(
      [
        "receitas",
        "despesasCorrentes",
        "parcelas",
        "veiculo",
        "eventos",
        "fundos",
        "despesasFixas",
        "transferencias",
        "cfg",
        "tvde",
      ].sort(),
    );
  });

  test("NÃO inclui iaUso — não tem store própria pra lê-lo sem ir à rede", () => {
    // Documenta a razão do bug, não só o sintoma: se algum dia isto passar a
    // falhar porque alguém criou um useIaUsoStore e passou a capturar o
    // domínio, ótimo — mas restaurarEstado tem de continuar protegendo
    // qualquer domínio ausente da mesma forma (ver teste abaixo).
    const arvore = JSON.parse(capturarEstadoAtual());
    expect(arvore.iaUso).toBeUndefined();
  });

  test("veículo entra como um só objeto com as 4 sub-coleções, cada uma já em mapa", () => {
    veiculo = {
      cargas: [{ id: "c1", litros: 40 }],
      despesas: [],
      despesasFixas: [],
      quilometragem: [{ id: "k1", valor: 15000 }],
    };

    const arvore = JSON.parse(capturarEstadoAtual());

    expect(arvore.veiculo).toEqual({
      cargas: { c1: { litros: 40 } },
      despesas: {},
      despesasFixas: {},
      quilometragem: { k1: { valor: 15000 } },
    });
  });

  test("cfg e tvde entram como objeto direto, sem paraMapa — não são listas", () => {
    cfg = { currency: "EUR", modoDiscreto: true };
    tvde = { metaMensal: 150000 };

    const arvore = JSON.parse(capturarEstadoAtual());

    expect(arvore.cfg).toEqual(cfg);
    expect(arvore.tvde).toEqual(tvde);
  });
});

describe("restaurarEstado — o bug que isto existe pra prevenir", () => {
  test("usa update(), não set() — um domínio fora da captura (iaUso) nunca é tocado", async () => {
    await restaurarEstado("u1", capturarEstadoAtual());

    // A prova real: o `arvore` passado pro update() não menciona `iaUso` em
    // lugar nenhum, e update() só mexe nas chaves que APARECEM no objeto —
    // é essa propriedade (não uma checagem de nome de função) que garante
    // que a cota de IA sobrevive a um desfazer/refazer.
    expect(atualizarNaRaiz).toHaveBeenCalledTimes(1);
    const [, dados] = atualizarNaRaiz.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(dados as object, "iaUso")).toBe(false);
  });

  test("aponta pra raiz de fin_v5 da conta certa", async () => {
    await restaurarEstado("u42", capturarEstadoAtual());

    expect(refChamado).toHaveBeenCalledWith({}, "users/u42/fin_v5");
  });

  test("restaura exatamente o que foi capturado, incluindo dados reais", async () => {
    receitas = [{ id: "r1", valor: 500, descricao: "Freelance" }];
    despesasCorrentes = [{ id: "d1", valor: -200, descricao: "Renda" }];

    await restaurarEstado("u1", capturarEstadoAtual());

    const [, dados] = atualizarNaRaiz.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(dados.receitas).toEqual({ r1: { valor: 500, descricao: "Freelance" } });
    expect(dados.despesasCorrentes).toEqual({ d1: { valor: -200, descricao: "Renda" } });
  });

  test("estado vindo de fora (string arbitrária) é interpretado como JSON, não como texto literal", async () => {
    await restaurarEstado("u1", '{"cfg":{"currency":"USD"}}');

    const [, dados] = atualizarNaRaiz.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(dados).toEqual({ cfg: { currency: "USD" } });
  });
});
