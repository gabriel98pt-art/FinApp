// @vitest-environment jsdom

// Importar é a tela onde a pessoa decide o que entra nas contas dela a partir
// de um extrato. Os selos de confiança e os filtros são o que orienta essa
// decisão — e os filtros foram o quarto sítio a receber o padrão de abas.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LinhaAnalisada, LinhaExtrato } from "../types";
import { analisarLinha } from "../utils/importacao";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const extrairExtratoPdf = vi.hoisted(() => vi.fn());
vi.mock("../utils/extrairExtratoPdf", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  extrairExtratoPdf,
}));
vi.mock("../services/importacaoService", () => ({
  apagarExistentes: vi.fn(async () => {}),
  construirExistentes: () => [],
  confirmarImportacao: vi.fn(async () => {}),
  dadosDaCarga: vi.fn(),
  dadosDaTransferencia: vi.fn(),
  pagamentoDaLinha: vi.fn(),
}));

let linhas: LinhaAnalisada[] | null = [];
let importadoEm: number | null = null;
const setLinhas = vi.fn();
const setTexto = vi.fn();
const setImportadoEm = vi.fn();

vi.mock("../stores/importacaoStore", () => ({
  useImportacaoStore: (s: (e: unknown) => unknown) =>
    s({
      texto: "",
      setTexto,
      linhas,
      setLinhas,
      importadoEm,
      setImportadoEm,
      resetar: vi.fn(),
    }),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasStore: (s: (e: unknown) => unknown) => s(lista()),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculoVazio()),
}));
let cfg = CONFIG_PADRAO;
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const mostrarToast = vi.hoisted(() => vi.fn());
vi.mock("../stores/toastStore", () => ({ mostrarToast }));

const Importar = (await import("./Importar")).default;

/** Constrói a linha com a própria `analisarLinha` em vez de a inventar à mão.
 *  Um stub literal deste tipo precisa de `classificacao` e `duplicata`
 *  aninhados, e quando falta um deles a página rebenta com "Cannot read
 *  properties of undefined" — que não diz qual campo é. Assim a forma não pode
 *  divergir do tipo real. */
const linha = (extra: Partial<LinhaExtrato> = {}): LinhaAnalisada =>
  analisarLinha(
    { data: "2026-08-03", descricao: "MERCADO CONTINENTE", valor: -4250, ...extra },
    1,
    {
      parcelas: [],
      categoriasConfiguradas: CONFIG_PADRAO.categoriasDespesa,
      despesasHistorico: [],
      receitasHistorico: [],
      locaisCarregamento: [],
      cargasHistorico: [],
      existentes: [],
    },
  );

beforeEach(() => {
  linhas = [];
  importadoEm = null;
  cfg = CONFIG_PADRAO;
  setLinhas.mockClear();
  setImportadoEm.mockClear();
  setTexto.mockClear();
  mostrarToast.mockClear();
  extrairExtratoPdf.mockReset();
});

describe("Importar", () => {
  test("monta e mostra a área de colar o extrato", () => {
    render(<Importar />);
    expect(screen.getByRole("heading", { name: "Importar" })).toBeInTheDocument();
  });

  test("sem linhas analisadas: não mostra a lista de revisão", () => {
    render(<Importar />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  test("com linhas: aparecem os filtros e a linha do extrato", () => {
    linhas = [linha()];
    render(<Importar />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByDisplayValue("MERCADO CONTINENTE")).toBeInTheDocument();
  });

  test("os filtros são um tablist com painel — e o painel é a lista", () => {
    // Variante de painel único: os separadores apontam todos para a mesma
    // lista, que muda de rótulo conforme o filtro escolhido.
    linhas = [linha()];
    render(<Importar />);

    const todas = screen.getByRole("tab", { name: /Todas/ });
    const painel = screen.getByRole("tabpanel");
    expect(todas).toHaveAttribute("aria-controls", painel.id);
    expect(painel).toHaveAttribute("aria-labelledby", todas.id);
  });

  test("setas percorrem os filtros", async () => {
    linhas = [linha()];
    render(<Importar />);
    screen.getByRole("tab", { selected: true }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Auto-classificadas/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("filtrar por uma decisão sem linhas esvazia a lista", async () => {
    linhas = [linha()];
    render(<Importar />);

    await userEvent.click(screen.getByRole("tab", { name: /Prováveis duplicatas/ }));
    expect(screen.queryByDisplayValue("MERCADO CONTINENTE")).not.toBeInTheDocument();
  });

  test("aria-busy fica true enquanto lê o PDF — achado da auditoria de Acessibilidade: o toast some sozinho antes de PDFs grandes terminarem", async () => {
    linhas = null;
    let resolver: (v: unknown[]) => void = () => {};
    extrairExtratoPdf.mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r;
        }),
    );

    const { container } = render(<Importar />);
    const entrada = screen.getByText("Colar ou carregar extrato").parentElement!;
    expect(entrada).toHaveAttribute("aria-busy", "false");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const arquivo = new File(["conteudo"], "extrato.pdf", { type: "application/pdf" });
    await userEvent.upload(input, arquivo);

    await waitFor(() => expect(entrada).toHaveAttribute("aria-busy", "true"));

    resolver([]);
    await waitFor(() => expect(entrada).toHaveAttribute("aria-busy", "false"));
  });

  // Achado ao investigar "confirmei sem querer, desfiz, e tive que marcar
  // tudo de novo": depois de importar, a revisão não some — fica visível como
  // "importado" (as marcações continuam lá), pronta a reaparecer se o usuário
  // desfizer. Só some sozinha depois de um tempo, ou se ele limpar à mão.
  describe("estado 'importado' — não perder as marcações num Desfazer acidental", () => {
    test("com importadoEm marcado, mostra o aviso em vez da lista de revisão", () => {
      linhas = [linha()];
      importadoEm = Date.now();
      render(<Importar />);

      expect(screen.getByText(/lançamento\(s\) importado\(s\)/)).toBeInTheDocument();
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Confirmar importação/ }),
      ).not.toBeInTheDocument();
    });

    test("'limpa agora' apaga o rascunho inteiro, não só a lista", async () => {
      linhas = [linha()];
      importadoEm = Date.now();
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: "limpa agora" }));

      expect(setLinhas).toHaveBeenCalledWith(null);
      expect(setTexto).toHaveBeenCalledWith("");
      expect(setImportadoEm).toHaveBeenCalledWith(null);
    });

    test("sem importadoEm, a lista de revisão aparece normalmente", () => {
      linhas = [linha()];
      importadoEm = null;
      render(<Importar />);

      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação/ })).toBeInTheDocument();
    });
  });

  // O ⌘V/onPaste da caixa só serve a quem tem teclado. No iPhone não há ⌘V, e
  // o menu "Colar" do iOS nem aparece quando o que está copiado é um ficheiro:
  // o botão abaixo é o único caminho que resta nesses casos.
  describe("botão Colar", () => {
    const comClipboard = (impl: Partial<Clipboard>) => {
      Object.defineProperty(navigator, "clipboard", {
        value: impl,
        configurable: true,
        writable: true,
      });
    };

    test("texto copiado entra na caixa pelo botão", async () => {
      linhas = null;
      comClipboard({ readText: vi.fn(async () => "10/07/2026;Mercado;-45,90") });
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: /Colar/ }));

      await waitFor(() => expect(setTexto).toHaveBeenCalledWith("10/07/2026;Mercado;-45,90"));
    });

    test("área de transferência sem texto (PDF copiado) aponta para Carregar arquivo", async () => {
      linhas = null;
      comClipboard({ readText: vi.fn(async () => "") });
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: /Colar/ }));

      await waitFor(() => expect(mostrarToast).toHaveBeenCalledWith(expect.stringMatching(/PDF/)));
      expect(setTexto).not.toHaveBeenCalled();
    });

    test("permissão negada não deixa a tela sem explicação", async () => {
      linhas = null;
      comClipboard({
        readText: vi.fn(async () => {
          throw new Error("NotAllowedError");
        }),
      });
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: /Colar/ }));

      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith(expect.stringMatching(/Carregar arquivo/)),
      );
      expect(setTexto).not.toHaveBeenCalled();
    });
  });

  // Achado do Gabriel (06/10/2026): despesa/receita importada sem conta
  // passava calada — só recarga/transferência/fatura travavam a confirmação.
  // Dezenas de linhas entravam sem cartão nenhum, sem nenhum aviso.
  describe("despesa/receita sem conta trava a confirmação", () => {
    test("com contas cadastradas, linha sem conta desativa 'Confirmar importação' e mostra o aviso", () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: ["Revolut", "ActivoBank"] };
      linhas = [linha()];
      render(<Importar />);

      expect(screen.getByText("Escolha a conta ou cartão desta linha.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação/ })).toBeDisabled();
    });

    test("escolhendo a conta, o aviso some e o botão reativa", () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: ["Revolut", "ActivoBank"] };
      linhas = [{ ...linha(), contaEscolhida: "Revolut" }];
      render(<Importar />);

      expect(screen.queryByText("Escolha a conta ou cartão desta linha.")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação/ })).not.toBeDisabled();
    });

    test("sem nenhuma conta cadastrada, não trava — não há o que escolher", () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [linha()];
      render(<Importar />);

      expect(screen.queryByText("Escolha a conta ou cartão desta linha.")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar importação/ })).not.toBeDisabled();
    });
  });

  // Pedido do Gabriel (06/10/2026): o pop-up de permissão do
  // `clipboard.readText()` só é necessário em quem não tem Ctrl+V físico
  // (telemóvel). No desktop o botão continua a existir (funciona igual), só
  // perde destaque — vira link em vez de botão do mesmo peso que "Carregar
  // arquivo". `setup.ts` já simula desktop por padrão (matchMedia sempre
  // false); aqui simula-se o caso touch puro para o outro lado do contraste.
  describe("peso visual do botão Colar conforme o dispositivo", () => {
    function simularTouchPuro(ehTouchPuro: boolean) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: ehTouchPuro && query === "(hover: none) and (pointer: coarse)",
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      });
    }

    test("desktop (tem mouse): Colar vira link discreto, sem ícone", () => {
      linhas = null;
      simularTouchPuro(false);
      render(<Importar />);

      const botaoColar = screen.getByRole("button", { name: "Colar" });
      expect(botaoColar.querySelector("svg")).toBeNull();
    });

    test("telemóvel (touch puro, sem mouse): Colar continua em destaque, com ícone", () => {
      linhas = null;
      simularTouchPuro(true);
      render(<Importar />);

      const botaoColar = screen.getByRole("button", { name: /Colar/ });
      expect(botaoColar.querySelector("svg")).not.toBeNull();
    });
  });
});
