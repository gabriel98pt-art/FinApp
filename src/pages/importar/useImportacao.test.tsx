// @vitest-environment jsdom

// Correções da tela Importar que vivem no hook: contagem da tela "importado",
// limpeza do estado local ao recomeçar, índice do undo guardado na store,
// confirmar sem sessão e erro ao ler um CSV.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import { lista, veiculoVazio } from "../../testes/dobras";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));

let uid: string | undefined = "u1";
vi.mock("../../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: uid ? { uid } : null }),
}));
vi.mock("../../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
vi.mock("../../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => async () => true }));

const mostrarToast = vi.fn();
vi.mock("../../stores/toastStore", () => ({
  mostrarToast: (...a: unknown[]) => mostrarToast(...a),
}));

const confirmarImportacao = vi.fn();
vi.mock("../../services/importacaoService", async (original) => ({
  ...(await original<typeof import("../../services/importacaoService")>()),
  confirmarImportacao: (...a: unknown[]) => confirmarImportacao(...a),
  apagarExistentes: vi.fn(async () => {}),
}));

let parserFalha = false;
vi.mock("../../utils/importacaoParser", async (original) => {
  const real = await original<typeof import("../../utils/importacaoParser")>();
  return {
    ...real,
    parseExtratoCsv: (texto: string) => {
      if (parserFalha) throw new Error("csv partido");
      return real.parseExtratoCsv(texto);
    },
  };
});

const { useImportacao } = await import("./useImportacao");
const { useImportacaoStore } = await import("../../stores/importacaoStore");
const { useHistoricoStore } = await import("../../stores/historicoStore");

const CSV = [
  "Data;Descrição;Valor",
  "10/07/2026;Mercado;-45,90",
  "11/07/2026;Farmacia;-12,30",
  "13/07/2026;Restaurante;-28,00",
].join("\n");

function analisarCsv(r: { current: ReturnType<typeof useImportacao> }) {
  act(() => r.current.setTexto(CSV));
  act(() => r.current.analisarTexto());
}

/** Espera as promessas pendentes (o `pedirConfirmacao` assíncrono). */
const esperar = () => act(async () => {});

beforeEach(() => {
  uid = "u1";
  parserFalha = false;
  mostrarToast.mockReset();
  confirmarImportacao.mockReset();
  useImportacaoStore.getState().resetar();
  useHistoricoStore.setState({ uid: null, pilha: { pilha: [], indice: -1 } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tela 'importado' (#1)", () => {
  test("guarda quantos lançamentos foram gravados, sem contar as puladas", async () => {
    confirmarImportacao.mockResolvedValue(2);
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    expect(result.current.linhas).toHaveLength(3);
    act(() => result.current.atualizarLinha(0, { acao: "skip" }));
    await act(() => result.current.confirmar());

    expect(confirmarImportacao.mock.calls[0][1]).toHaveLength(2);
    expect(result.current.mostrandoImportado).toBe(true);
    expect(result.current.totalImportado).toBe(2);
    expect(useImportacaoStore.getState().totalImportado).toBe(2);
  });

  test("limpar a revisão apaga o total e o índice guardados", async () => {
    confirmarImportacao.mockResolvedValue(3);
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    await act(() => result.current.confirmar());
    act(() => result.current.limparRevisao());
    const s = useImportacaoStore.getState();
    expect(s.totalImportado).toBeNull();
    expect(s.indiceAoImportar).toBeNull();
  });
});

describe("estado local ao recomeçar (#3, #4)", () => {
  test("'Novo extrato' zera a conta em massa e as outras pontas abertas", async () => {
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    act(() => result.current.marcarContaParaTodas("Conta Principal"));
    act(() => result.current.alternarOutraPonta(1));
    expect(result.current.contaEmMassa).toBe("Conta Principal");

    act(() => result.current.descartarLinhas());
    await esperar();
    expect(result.current.linhas).toBeNull();
    expect(result.current.contaEmMassa).toBe("");
    expect(result.current.outraPontaAberta.size).toBe(0);
  });

  test("'Resetar importação' zera a conta em massa e as outras pontas abertas", async () => {
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    act(() => result.current.marcarContaParaTodas("Conta Principal"));
    act(() => result.current.alternarOutraPonta(0));

    act(() => result.current.resetarImportacao());
    await esperar();
    expect(result.current.contaEmMassa).toBe("");
    expect(result.current.outraPontaAberta.size).toBe(0);
  });

  test("analisar um extrato novo fecha as outras pontas do anterior", () => {
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    act(() => result.current.alternarOutraPonta(2));
    expect(result.current.outraPontaAberta.has(2)).toBe(true);
    act(() => result.current.analisarTexto());
    expect(result.current.outraPontaAberta.size).toBe(0);
  });
});

describe("índice do undo na store (#5)", () => {
  async function importarComPilha() {
    // Pilha com 3 passos e o snapshot da importação no topo (índice 2).
    useHistoricoStore.setState({ uid: "u1", pilha: { pilha: ["a", "b", "c"], indice: 2 } });
    confirmarImportacao.mockResolvedValue(3);
    const pagina = renderHook(() => useImportacao());
    analisarCsv(pagina.result);
    await act(() => pagina.result.current.confirmar());
    return pagina;
  }

  test("sai da aba e volta: um desfazer feito entretanto ainda é detectado", async () => {
    const pagina = await importarComPilha();
    expect(useImportacaoStore.getState().indiceAoImportar).toBe(2);
    pagina.unmount();

    // Desfazer pelo menu "Mais", noutra aba.
    useHistoricoStore.setState({ pilha: { pilha: ["a", "b", "c", "d"], indice: 1 } });

    const { result } = renderHook(() => useImportacao());
    expect(result.current.mostrandoImportado).toBe(false);
  });

  test("depois de um refresh (pilha vazia) não finge que foi desfeito", async () => {
    const pagina = await importarComPilha();
    pagina.unmount();
    useHistoricoStore.setState({ pilha: { pilha: [], indice: -1 } });

    const { result } = renderHook(() => useImportacao());
    expect(result.current.mostrandoImportado).toBe(true);
  });
});

describe("confirmar sem sessão (#7)", () => {
  test("avisa em vez de sair calado", async () => {
    uid = undefined;
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    mostrarToast.mockReset();
    await act(() => result.current.confirmar());
    expect(mostrarToast).toHaveBeenCalledWith("Sessão não carregada. Tente de novo.");
    expect(confirmarImportacao).not.toHaveBeenCalled();
  });

  test("sem linhas não há o que confirmar, nem toast", async () => {
    uid = undefined;
    const { result } = renderHook(() => useImportacao());
    await act(() => result.current.confirmar());
    expect(mostrarToast).not.toHaveBeenCalled();
  });
});

describe("arquivo CSV com erro (#10)", () => {
  function carregar(r: { current: ReturnType<typeof useImportacao> }, arquivo: File) {
    const evento = { target: { files: [arquivo], value: "x" } };
    act(() => r.current.aoCarregarArquivo(evento as unknown as ChangeEvent<HTMLInputElement>));
  }

  test("parser que rebenta vira toast de erro", async () => {
    parserFalha = true;
    const { result } = renderHook(() => useImportacao());
    carregar(result, new File([CSV], "extrato.csv", { type: "text/csv" }));
    await vi.waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith("Não foi possível ler este arquivo CSV."),
    );
    expect(result.current.linhas).toBeNull();
  });

  test("falha de leitura do arquivo vira toast de erro", () => {
    class LeitorQueFalha {
      result: string | null = null;
      error = new Error("ilegível");
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        this.onerror?.();
      }
    }
    vi.stubGlobal("FileReader", LeitorQueFalha);
    const { result } = renderHook(() => useImportacao());
    carregar(result, new File([CSV], "extrato.csv", { type: "text/csv" }));
    expect(mostrarToast).toHaveBeenCalledWith("Não foi possível ler este arquivo CSV.");
  });

  test("CSV válido continua a ser analisado", async () => {
    const { result } = renderHook(() => useImportacao());
    carregar(result, new File([CSV], "extrato.csv", { type: "text/csv" }));
    await vi.waitFor(() => expect(result.current.linhas).toHaveLength(3));
  });
});

describe("pendências que travam = `incompletas` (a contagem do botão não mente)", () => {
  test("linha a linha, a pendência vermelha é exatamente o que trava a gravação", async () => {
    const { pendenciasDaLinha } = await import("./agrupamento");
    const { result } = renderHook(() => useImportacao());
    act(() =>
      result.current.setTexto(
        [
          "Data;Descrição;Valor",
          ...Array.from({ length: 8 }, (_, i) => `1${i}/07/2026;Linha ${i};-${i + 1}0,00`),
        ].join("\n"),
      ),
    );
    act(() => result.current.analisarTexto());
    const mudar = (id: number, m: Parameters<typeof result.current.atualizarLinha>[1]) =>
      act(() => result.current.atualizarLinha(id, m));
    mudar(0, { destino: "carga", localCarga: "" });
    mudar(1, { destino: "carga", localCarga: "Ionity", kwhCarga: "" });
    mudar(2, { destino: "transferencia_cartao", contaOrigem: "", contaDestino: "" });
    mudar(3, { destino: "transferencia_cartao", contaOrigem: "A", contaDestino: "A" });
    mudar(4, { destino: "pagamento_fatura", fatCartaoEscolhido: "" });
    mudar(5, { destino: "pagamento_fatura", fatCartaoEscolhido: "Visa", contaOrigem: "" });
    mudar(6, { destino: "carga", localCarga: "", acao: "skip" });

    const incompletas = new Set(result.current.incompletas.map((l) => l.id));
    for (const l of result.current.linhas!) {
      const trava = pendenciasDaLinha(l, CONFIG_PADRAO.contasCartoes.length > 0).some(
        (p) => p.bloqueia,
      );
      expect(trava, `linha ${l.id}`).toBe(incompletas.has(l.id));
    }
    expect(incompletas).toEqual(new Set([0, 2, 3, 4, 5]));
  });
});

describe("folha de duplicatas antes de gravar", () => {
  test("`confirmar` nunca grava duplicatas sem a folha delas ter sido vista", async () => {
    const { result } = renderHook(() => useImportacao());
    analisarCsv(result);
    act(() =>
      result.current.atualizarLinha(0, {
        decisao: "duplicata_provavel",
        duplicata: {
          status: "exact_duplicate",
          confianca: "high",
          score: 100,
          motivos: ["mesmo valor"],
          correspondencia: {
            id: "x",
            data: "2026-07-10",
            valor: -4590,
            descricao: "Mercado",
            origem: "despesa",
          },
        },
      }),
    );
    await act(() => result.current.confirmar());
    expect(confirmarImportacao).not.toHaveBeenCalled();
    expect(result.current.revisaoDup).toHaveLength(1);

    act(() => result.current.importarMesmoAssim());
    expect(result.current.resumoAberto).toBe(true);
    confirmarImportacao.mockResolvedValue(3);
    await act(() => result.current.confirmar());
    expect(confirmarImportacao).toHaveBeenCalledTimes(1);
  });
});
