// @vitest-environment jsdom

// Importar é a tela onde a pessoa decide o que entra nas contas dela a partir
// de um extrato. Os selos de confiança e os filtros são o que orienta essa
// decisão — e os filtros foram o quarto sítio a receber o padrão de abas.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ExistenteParaDedup, LinhaAnalisada, LinhaExtrato } from "../types";
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
const { confirmarImportacao } = await import("../services/importacaoService");

/** Constrói a linha com a própria `analisarLinha` em vez de a inventar à mão.
 *  Um stub literal deste tipo precisa de `classificacao` e `duplicata`
 *  aninhados, e quando falta um deles a página rebenta com "Cannot read
 *  properties of undefined" — que não diz qual campo é. Assim a forma não pode
 *  divergir do tipo real. */
const linha = (
  extra: Partial<LinhaExtrato> = {},
  id = 1,
  existentes: ExistenteParaDedup[] = [],
): LinhaAnalisada =>
  analisarLinha(
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

/** Uma linha que bate exatamente com um registo já existente — vira
 *  "provável duplicata". */
const duplicata = (id = 2): LinhaAnalisada =>
  linha({ descricao: "PADARIA CENTRAL", valor: -320 }, id, [
    {
      id: "d1",
      data: "2026-08-03",
      valor: -320,
      descricao: "PADARIA CENTRAL Alimentação",
      origem: "despesa",
    },
  ]);

/** Os cabeçalhos dos grupos, pela ordem em que aparecem. */
const cabecalhosDosGrupos = () =>
  screen
    .getAllByRole("button")
    .filter((b) => /^(Atenção|Duplicatas|Prontos)/.test(b.textContent ?? ""));
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

const CONTAS = { ...CONFIG_PADRAO, contasCartoes: ["Revolut", "ActivoBank"] };

describe("Importar", () => {
  test("monta e mostra a área de escolher o extrato", () => {
    linhas = null;
    render(<Importar />);
    expect(screen.getByRole("heading", { name: "Importar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Carregar arquivo/ })).toBeInTheDocument();
  });

  test("sem linhas analisadas: não mostra a revisão", () => {
    render(<Importar />);
    expect(screen.queryByRole("group", { name: "Filtrar linhas por estado" })).toBeNull();
  });

  // Fluxo único: a caixa de texto não ocupa a tela à partida — só abre quando
  // se escolhe "Colar texto". "Carregar arquivo" é o caminho principal.
  describe("estado vazio", () => {
    test("a caixa de texto só aparece depois de escolher 'Colar texto'", async () => {
      linhas = null;
      render(<Importar />);
      expect(screen.queryByRole("textbox")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: "Colar texto" }));
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Analisar" })).toBeInTheDocument();
    });
  });

  // A revisão agrupa por estado, não por data: Atenção primeiro (aberto),
  // depois Duplicatas e Prontos (recolhidos).
  describe("agrupamento por estado", () => {
    test("grupos na ordem Atenção, Duplicatas, Prontos — só Atenção aberto", () => {
      cfg = CONTAS;
      linhas = [
        // Prontos: tem conta e categoria.
        { ...linha({ descricao: "FARMACIA" }, 3), contaEscolhida: "Revolut" },
        // Duplicatas: bate com um registo existente (fica de fora por omissão).
        duplicata(2),
        // Atenção: marcada para importar e sem conta.
        linha({}, 1),
      ];
      render(<Importar />);

      const grupos = cabecalhosDosGrupos();
      expect(grupos.map((b) => b.textContent?.match(/^(Atenção|Duplicatas|Prontos)/)?.[1])).toEqual(
        ["Atenção", "Duplicatas", "Prontos"],
      );
      expect(grupos[0]).toHaveAttribute("aria-expanded", "true");
      expect(grupos[1]).toHaveAttribute("aria-expanded", "false");
      expect(grupos[2]).toHaveAttribute("aria-expanded", "false");

      // Só a linha de Atenção está à vista, com o que falta por baixo.
      expect(screen.getByRole("button", { name: /MERCADO CONTINENTE.*Falta conta/ })).toBeVisible();
      expect(screen.queryByRole("button", { name: /PADARIA CENTRAL/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /FARMACIA/ })).toBeNull();
    });

    test("abrir um grupo recolhido mostra as linhas dele", async () => {
      cfg = CONTAS;
      linhas = [duplicata(2)];
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: /^Duplicatas/ }));
      expect(screen.getByRole("button", { name: /^Duplicatas/ })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getByRole("button", { name: /PADARIA CENTRAL.*Já registado/ })).toBeVisible();
    });

    test("os segmentos do topo contam e filtram", async () => {
      cfg = CONTAS;
      linhas = [linha({}, 1), duplicata(2)];
      render(<Importar />);

      const grupo = screen.getByRole("group", { name: "Filtrar linhas por estado" });
      const dup = within(grupo).getByRole("button", { name: /1 duplicata/ });
      expect(within(grupo).getByRole("button", { name: /1 revisar/ })).toBeInTheDocument();

      await userEvent.click(dup);
      expect(dup).toHaveAttribute("aria-pressed", "true");
      // Filtrado: só a duplicata, com o grupo dela aberto.
      expect(screen.getByRole("button", { name: /PADARIA CENTRAL/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /MERCADO CONTINENTE/ })).toBeNull();

      // Escolher outra vez o mesmo segmento volta a mostrar tudo.
      await userEvent.click(dup);
      expect(dup).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /MERCADO CONTINENTE/ })).toBeInTheDocument();
    });

    test("expandir uma duplicata mostra 'Novo no extrato' ao lado de 'Já registado'", async () => {
      linhas = [duplicata(2)];
      render(<Importar />);
      await userEvent.click(screen.getByRole("button", { name: /^Duplicatas/ }));
      await userEvent.click(screen.getByRole("button", { name: /PADARIA CENTRAL/ }));

      const editor = screen.getByRole("group", { name: "Editar PADARIA CENTRAL" });
      expect(within(editor).getByText("Novo no extrato")).toBeInTheDocument();
      expect(within(editor).getByText("Já registado")).toBeInTheDocument();
    });
  });

  describe("campos com nome e 'Sem categoria'", () => {
    test("o editor tem Tipo, Conta ou cartão e Categoria, com rótulo fixo", async () => {
      cfg = CONTAS;
      linhas = [linha()];
      render(<Importar />);
      await userEvent.click(screen.getByRole("button", { name: /MERCADO CONTINENTE/ }));

      expect(screen.getByText("Tipo")).toBeInTheDocument();
      expect(screen.getByText("Conta ou cartão")).toBeInTheDocument();
      expect(screen.getByText("Categoria")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tipo" })).toHaveTextContent("Despesa");
    });

    test("linha que a classificação não reconheceu mostra 'Sem categoria', não 'Outros'", async () => {
      linhas = [linha({ descricao: "ZZZ999 QWERTY" })];
      render(<Importar />);
      expect(screen.getByRole("button", { name: /ZZZ999 QWERTY.*Sem categoria/ })).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: /ZZZ999 QWERTY/ }));

      expect(screen.getByRole("button", { name: "Categoria" })).toHaveTextContent("Sem categoria");
      expect(screen.getByRole("button", { name: "Categoria" })).not.toHaveTextContent("Outros");
    });
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
    test("com importadoEm marcado, mostra a faixa de sucesso em vez da revisão", () => {
      linhas = [linha()];
      importadoEm = Date.now();
      render(<Importar />);

      expect(screen.getByText(/1 lançamento importado/)).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Filtrar linhas por estado" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Importar \d/ })).not.toBeInTheDocument();
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

    test("sem importadoEm, a revisão aparece normalmente", () => {
      linhas = [linha()];
      importadoEm = null;
      render(<Importar />);

      expect(screen.getByRole("group", { name: "Filtrar linhas por estado" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Importar 1" })).toBeInTheDocument();
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

    async function abrirCaixa() {
      await userEvent.click(screen.getByRole("button", { name: "Colar texto" }));
    }

    test("texto copiado entra na caixa pelo botão", async () => {
      linhas = null;
      comClipboard({ readText: vi.fn(async () => "10/07/2026;Mercado;-45,90") });
      render(<Importar />);
      await abrirCaixa();

      await userEvent.click(screen.getByRole("button", { name: "Colar" }));

      await waitFor(() => expect(setTexto).toHaveBeenCalledWith("10/07/2026;Mercado;-45,90"));
    });

    test("área de transferência sem texto (PDF copiado) aponta para Carregar arquivo", async () => {
      linhas = null;
      comClipboard({ readText: vi.fn(async () => "") });
      render(<Importar />);
      await abrirCaixa();

      await userEvent.click(screen.getByRole("button", { name: "Colar" }));

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
      await abrirCaixa();

      await userEvent.click(screen.getByRole("button", { name: "Colar" }));

      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith(expect.stringMatching(/Carregar arquivo/)),
      );
      expect(setTexto).not.toHaveBeenCalled();
    });
  });

  // Achado do Gabriel (06/10/2026): despesa/receita importada sem conta
  // passava calada — só recarga/transferência/fatura travavam a confirmação.
  // Dezenas de linhas entravam sem cartão nenhum, sem nenhum aviso.
  describe("despesa/receita sem conta trava a importação", () => {
    test("com contas cadastradas, linha sem conta trava o botão e mostra o erro no próprio campo", async () => {
      cfg = CONTAS;
      linhas = [linha()];
      render(<Importar />);

      expect(screen.getByRole("button", { name: "Importar 1" })).toBeDisabled();
      expect(screen.getByText(/1 linha por completar/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /MERCADO CONTINENTE/ }));
      const conta = screen.getByRole("button", { name: "Conta ou cartão" });
      const erro = screen.getByText("Escolha a conta ou cartão desta linha.");
      expect(conta).toHaveAttribute("aria-invalid", "true");
      expect(conta).toHaveAttribute("aria-describedby", erro.id);
    });

    test("escolhendo a conta, o aviso some e o botão reativa", () => {
      cfg = CONTAS;
      linhas = [{ ...linha(), contaEscolhida: "Revolut" }];
      render(<Importar />);

      expect(screen.queryByText(/Falta conta/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Importar 1" })).not.toBeDisabled();
    });

    test("sem nenhuma conta cadastrada, não trava — não há o que escolher", () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [linha()];
      render(<Importar />);

      expect(screen.queryByText(/Falta conta/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Importar 1" })).not.toBeDisabled();
    });
  });

  // O número do botão é o que entra: todas as marcadas, nem mais nem menos.
  describe("contagem do botão principal", () => {
    test("conta só as linhas marcadas para importar; as outras ficam de fora", () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [
        linha({}, 1),
        linha({ descricao: "PADARIA" }, 2),
        { ...linha({ descricao: "LOJA" }, 3), acao: "skip" },
      ];
      render(<Importar />);

      expect(screen.getByRole("button", { name: "Importar 2" })).toBeInTheDocument();
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
        "2 marcados para importar · 1 de fora",
      );
    });
  });

  // Fase 3 do redesign: o botão principal abre um resumo do lote (quantas
  // entram, por decisão, quantas ficam de fora). A gravação só acontece no
  // botão final desse resumo.
  describe("confirmação antes de gravar", () => {
    test("'Importar N' abre a confirmação e ainda não grava", async () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [linha(), { ...linha({ descricao: "PADARIA" }), id: 2, acao: "skip" }];
      vi.mocked(confirmarImportacao).mockClear();
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));

      const folha = await screen.findByRole("dialog", { name: "Rever antes de importar" });
      expect(within(folha).getByRole("button", { name: "Importar 1" })).toBeInTheDocument();
      expect(within(folha).getByText("1 fica de fora (não será importado).")).toBeInTheDocument();
      // Nada marcado para excluir: a linha de exclusão nem aparece.
      expect(within(folha).queryByText(/serão? excluídos?/)).toBeNull();
      expect(confirmarImportacao).not.toHaveBeenCalled();
    });

    test("o botão final da confirmação é que grava", async () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [linha()];
      vi.mocked(confirmarImportacao).mockClear();
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
      const folha = await screen.findByRole("dialog", { name: "Rever antes de importar" });
      await userEvent.click(within(folha).getByRole("button", { name: "Importar 1" }));

      await waitFor(() => expect(confirmarImportacao).toHaveBeenCalledTimes(1));
    });

    test("'Voltar à revisão' fecha sem gravar", async () => {
      cfg = { ...CONFIG_PADRAO, contasCartoes: [] };
      linhas = [linha()];
      vi.mocked(confirmarImportacao).mockClear();
      render(<Importar />);

      await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
      const folha = await screen.findByRole("dialog", { name: "Rever antes de importar" });
      await userEvent.click(within(folha).getByRole("button", { name: "Voltar à revisão" }));

      expect(confirmarImportacao).not.toHaveBeenCalled();
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

    test("desktop (tem mouse): Colar vira link discreto, sem ícone", async () => {
      linhas = null;
      simularTouchPuro(false);
      render(<Importar />);
      await userEvent.click(screen.getByRole("button", { name: "Colar texto" }));

      const botaoColar = screen.getByRole("button", { name: "Colar" });
      expect(botaoColar.querySelector("svg")).toBeNull();
    });

    test("telemóvel (touch puro, sem mouse): Colar continua em destaque, com ícone", async () => {
      linhas = null;
      simularTouchPuro(true);
      render(<Importar />);
      await userEvent.click(screen.getByRole("button", { name: "Colar texto" }));

      const botaoColar = screen.getByRole("button", { name: "Colar" });
      expect(botaoColar.querySelector("svg")).not.toBeNull();
    });
  });
});
