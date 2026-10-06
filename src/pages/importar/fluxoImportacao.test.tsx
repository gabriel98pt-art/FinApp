// @vitest-environment jsdom

// O fluxo da revisão de ponta a ponta, com a store do rascunho e o hook
// verdadeiros (só a gravação é dobrada): o número do botão é o que entra,
// excluir um registo existente pede confirmação própria e aparece separado de
// "fica de fora", mestre-detalhe no desktop e uma linha aberta de cada vez no
// telemóvel, e o "Desfazer" da faixa de sucesso.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfigConta, ExistenteParaDedup, LinhaAnalisada, LinhaExtrato } from "../../types";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import { analisarLinha } from "../../utils/importacao";
import { lista, veiculoVazio } from "../../testes/dobras";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
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
let cfg: ConfigConta = CONFIG_PADRAO;
vi.mock("../../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => async () => true }));
vi.mock("../../stores/toastStore", () => ({ mostrarToast: vi.fn() }));

const confirmarImportacao = vi.fn();
const apagarExistentes = vi.fn();
vi.mock("../../services/importacaoService", async (original) => ({
  ...(await original<typeof import("../../services/importacaoService")>()),
  confirmarImportacao: (...a: unknown[]) => confirmarImportacao(...a),
  apagarExistentes: (...a: unknown[]) => apagarExistentes(...a),
}));

const Importar = (await import("../Importar")).default;
const { useImportacaoStore } = await import("../../stores/importacaoStore");
const { useHistoricoStore } = await import("../../stores/historicoStore");

const EXISTENTE: ExistenteParaDedup = {
  id: "d1",
  data: "2026-08-03",
  valor: -320,
  descricao: "PADARIA CENTRAL Alimentação",
  origem: "despesa",
};

function linha(
  extra: Partial<LinhaExtrato>,
  id: number,
  existentes: ExistenteParaDedup[] = [],
): LinhaAnalisada {
  return analisarLinha(
    { data: "2026-08-03", descricao: "MERCADO CONTINENTE", valor: -4250, ...extra },
    id,
    {
      parcelas: [],
      categoriasConfiguradas: CONFIG_PADRAO.categoriasDespesa,
      despesasHistorico: [],
      receitasHistorico: [],
      locaisCarregamento: [],
      cargasHistorico: [],
      existentes,
    },
  );
}

/** A duplicata já marcada para importar (por omissão viria de fora). */
const dupMarcada = (id = 2): LinhaAnalisada => ({
  ...linha({ descricao: "PADARIA CENTRAL", valor: -320 }, id, [EXISTENTE]),
  acao: "import",
});

function simularLargura(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: desktop && query === "(min-width: 1024px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

beforeEach(() => {
  cfg = CONFIG_PADRAO;
  confirmarImportacao.mockReset();
  confirmarImportacao.mockImplementation(async (_uid: string, l: LinhaAnalisada[]) => l.length);
  apagarExistentes.mockReset();
  apagarExistentes.mockResolvedValue(undefined);
  useImportacaoStore.getState().resetar();
  useHistoricoStore.setState({ uid: null, pilha: { pilha: [], indice: -1 } });
  simularLargura(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const folhaConfirmacao = () => screen.findByRole("dialog", { name: "Rever antes de importar" });
const folhaDuplicatas = () => screen.findByRole("dialog", { name: "Isto já parece existir" });

describe("contagem do botão = o que de facto é gravado", () => {
  test("o N do rodapé, da confirmação e do que vai para a gravação é o mesmo", async () => {
    useImportacaoStore.getState().setLinhas([
      linha({}, 1),
      linha({ descricao: "FARMACIA" }, 2),
      { ...linha({ descricao: "LOJA" }, 3), acao: "skip" },
      // Duplicata não marcada: fica de fora por omissão.
      linha({ descricao: "PADARIA CENTRAL", valor: -320 }, 4, [EXISTENTE]),
    ]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 2" }));
    const folha = await folhaConfirmacao();
    expect(folha).toHaveTextContent("2 lançamentos entram");
    expect(within(folha).getByText("2 ficam de fora (não serão importados).")).toBeInTheDocument();
    await userEvent.click(within(folha).getByRole("button", { name: "Importar 2" }));

    await waitFor(() => expect(confirmarImportacao).toHaveBeenCalledTimes(1));
    expect(confirmarImportacao.mock.calls[0][1]).toHaveLength(2);
    expect(await screen.findByText("2 lançamentos importados")).toBeInTheDocument();
  });

  test("linha marcada mas incompleta não é contada como 'entra' sem aviso — o botão trava", () => {
    cfg = { ...CONFIG_PADRAO, contasCartoes: ["Revolut"] };
    useImportacaoStore
      .getState()
      .setLinhas([{ ...linha({}, 1), contaEscolhida: "Revolut" }, linha({ descricao: "LOJA" }, 2)]);
    render(<Importar />);

    expect(screen.getByRole("button", { name: "Importar 2" })).toBeDisabled();
    expect(screen.getByText(/1 linha por completar/)).toBeInTheDocument();
  });
});

describe("duplicatas: excluir o existente é secundário e pede confirmação própria", () => {
  test("'Importar mesmo assim' mantém os dois — nada é excluído", async () => {
    useImportacaoStore.getState().setLinhas([dupMarcada()]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    const dups = await folhaDuplicatas();
    await userEvent.click(within(dups).getByRole("button", { name: "Importar mesmo assim" }));

    const folha = await folhaConfirmacao();
    expect(within(folha).queryByText(/excluíd/)).toBeNull();
    await userEvent.click(within(folha).getByRole("button", { name: "Importar 1" }));

    await waitFor(() => expect(confirmarImportacao).toHaveBeenCalledTimes(1));
    expect(apagarExistentes).not.toHaveBeenCalled();
  });

  test("'Excluir o existente…' só pede confirmação; cancelar não marca nada", async () => {
    useImportacaoStore.getState().setLinhas([dupMarcada()]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    const dups = await folhaDuplicatas();
    await userEvent.click(within(dups).getByRole("button", { name: "Excluir o existente…" }));
    expect(
      within(dups).getByText(
        "Isto apaga o lançamento que já está registado. Não dá para desfazer só por aqui.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(dups).getByRole("button", { name: "Cancelar" }));
    await userEvent.click(within(dups).getByRole("button", { name: "Importar mesmo assim" }));

    const folha = await folhaConfirmacao();
    expect(within(folha).queryByText(/excluíd/)).toBeNull();
    await userEvent.click(within(folha).getByRole("button", { name: "Importar 1" }));
    await waitFor(() => expect(confirmarImportacao).toHaveBeenCalledTimes(1));
    expect(apagarExistentes).not.toHaveBeenCalled();
  });

  test("só depois de confirmar a exclusão ela entra na gravação — e aparece à parte na confirmação", async () => {
    useImportacaoStore
      .getState()
      .setLinhas([dupMarcada(2), { ...linha({ descricao: "LOJA" }, 3), acao: "skip" }]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    const dups = await folhaDuplicatas();
    await userEvent.click(within(dups).getByRole("button", { name: "Excluir o existente…" }));
    await userEvent.click(within(dups).getByRole("button", { name: "Sim, excluir o existente" }));
    expect(
      within(dups).getByText("O lançamento já registado vai ser excluído."),
    ).toBeInTheDocument();
    await userEvent.click(within(dups).getByRole("button", { name: "Importar mesmo assim" }));

    // "Fica de fora" (linha do extrato) e "será excluído" (registo antigo)
    // são duas linhas diferentes.
    const folha = await folhaConfirmacao();
    expect(within(folha).getByText("1 fica de fora (não será importado).")).toBeInTheDocument();
    expect(within(folha).getByText("1 lançamento existente será excluído.")).toBeInTheDocument();
    expect(apagarExistentes).not.toHaveBeenCalled();

    await userEvent.click(within(folha).getByRole("button", { name: "Importar 1" }));
    await waitFor(() => expect(apagarExistentes).toHaveBeenCalledTimes(1));
    expect(apagarExistentes.mock.calls[0][1]).toEqual([EXISTENTE]);
  });

  test("'Manter o existente' desfaz a escolha antes de importar", async () => {
    useImportacaoStore.getState().setLinhas([dupMarcada()]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    const dups = await folhaDuplicatas();
    await userEvent.click(within(dups).getByRole("button", { name: "Excluir o existente…" }));
    await userEvent.click(within(dups).getByRole("button", { name: "Sim, excluir o existente" }));
    await userEvent.click(within(dups).getByRole("button", { name: "Manter o existente" }));
    await userEvent.click(within(dups).getByRole("button", { name: "Importar mesmo assim" }));

    const folha = await folhaConfirmacao();
    expect(within(folha).queryByText(/excluíd/)).toBeNull();
  });
});

describe("composição por largura", () => {
  test("desktop: mestre-detalhe — o editor da primeira linha de Atenção já aberto ao lado", async () => {
    simularLargura(true);
    cfg = { ...CONFIG_PADRAO, contasCartoes: ["Revolut"] };
    useImportacaoStore
      .getState()
      .setLinhas([linha({}, 1), { ...linha({ descricao: "FARMACIA" }, 2), acao: "skip" }]);
    render(<Importar />);

    expect(screen.getByRole("group", { name: "Editar MERCADO CONTINENTE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MERCADO CONTINENTE.*Falta conta/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Escolher a conta não faz a linha fugir do grupo a meio da edição.
    await userEvent.click(screen.getByRole("button", { name: "Conta ou cartão" }));
    await userEvent.click(await screen.findByRole("button", { name: "Revolut" }));
    expect(screen.getByRole("button", { name: /^MERCADO CONTINENTE/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Editar MERCADO CONTINENTE" })).toBeInTheDocument();
    expect(useImportacaoStore.getState().linhas?.[0].contaEscolhida).toBe("Revolut");
  });

  test("telemóvel: a linha abre por baixo dela, uma de cada vez", async () => {
    cfg = { ...CONFIG_PADRAO, contasCartoes: ["Revolut"] };
    useImportacaoStore.getState().setLinhas([linha({}, 1), linha({ descricao: "FARMACIA" }, 2)]);
    render(<Importar />);

    // Nada aberto à partida.
    expect(screen.queryByRole("group", { name: /^Editar/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^MERCADO CONTINENTE/ }));
    expect(screen.getByRole("group", { name: "Editar MERCADO CONTINENTE" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^FARMACIA/ }));
    expect(screen.getByRole("group", { name: "Editar FARMACIA" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Editar MERCADO CONTINENTE" })).toBeNull();

    // Tocar outra vez fecha.
    await userEvent.click(screen.getByRole("button", { name: /^FARMACIA/ }));
    expect(screen.queryByRole("group", { name: /^Editar/ })).toBeNull();
  });
});

describe("sucesso + desfazer", () => {
  test("'Desfazer' na faixa desfaz a importação e a revisão volta como estava", async () => {
    useHistoricoStore.setState({ uid: "u1", pilha: { pilha: ["a", "b"], indice: 1 } });
    const desfazer = vi.fn(async () => {
      useHistoricoStore.setState({ pilha: { pilha: ["a", "b", "vivo"], indice: 1 } });
    });
    useHistoricoStore.setState({ desfazer });
    useImportacaoStore.getState().setLinhas([linha({}, 1)]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    await userEvent.click(
      within(await folhaConfirmacao()).getByRole("button", { name: "Importar 1" }),
    );

    expect(await screen.findByText("1 lançamento importado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));

    expect(desfazer).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Importar 1" })).toBeInTheDocument(),
    );
    expect(useImportacaoStore.getState().linhas).toHaveLength(1);
  });

  test("com outra ação depois da importação, o botão some (desfaria a outra ação)", async () => {
    useHistoricoStore.setState({ uid: "u1", pilha: { pilha: ["a", "b"], indice: 1 } });
    useImportacaoStore.getState().setLinhas([linha({}, 1)]);
    render(<Importar />);

    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    await userEvent.click(
      within(await folhaConfirmacao()).getByRole("button", { name: "Importar 1" }),
    );
    expect(await screen.findByRole("button", { name: "Desfazer" })).toBeInTheDocument();

    act(() => useHistoricoStore.setState({ pilha: { pilha: ["a", "b", "c"], indice: 2 } }));
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
    expect(screen.getByText(/menu/)).toBeInTheDocument();
  });
});
