// @vitest-environment jsdom

// Cartões calcula o valor das faturas a partir de cinco domínios. O aviso de
// sincronização é o que impede um "Devido no mês" MENOR do que o real de
// passar por número certo — e uma fatura que parece mais barata leva a pagar
// a menos, coisa que só se descobre no mês seguinte.

import { afterAll, describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ConfigConta, DespesaCorrente, Transferencia } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, listaComErro, veiculoVazio } from "../testes/dobras";
import { comInstituicoes, instituicao } from "../testes/instituicoes";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../services/faturaService", () => ({
  pagarFatura: vi.fn(async () => {}),
  removerPagamentoFatura: vi.fn(async () => {}),
  reabrirFatura: vi.fn(async () => {}),
}));
vi.mock("../services/cfgService", () => ({
  adicionarCartao: vi.fn(async () => {}),
  adicionarMetodo: vi.fn(async () => {}),
  removerCartao: vi.fn(async () => {}),
  renomearCartao: vi.fn(async () => {}),
  definirDiaVencimentoFatura: vi.fn(async () => {}),
  definirDiaFechamentoFatura: vi.fn(async () => {}),
  definirFaturaManual: vi.fn(async () => {}),
  definirSaldoInicial: vi.fn(async () => {}),
}));

const { adicionarMetodo } = await import("../services/cfgService");

const CARTAO = "AB Gold (C)";
const CONTA = "Conta Principal";
// Anotado como ConfigConta e não inferido do valor inicial: sem a anotação, o
// TypeScript fecha `tipoCartao` no literal `{ "AB Gold (C)": "credit" }` e o
// teste que reatribui um `{}` (para o caso "sem contas") deixa de compilar.
let cfg: ConfigConta = {
  ...CONFIG_PADRAO,
  contasCartoes: [CARTAO],
  tipoCartao: { [CARTAO]: "credit" },
};
let despesas = lista<DespesaCorrente>();
let transferencias = lista<Transferencia>();
let veiculo = veiculoVazio();

vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(lista()),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(transferencias),
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(lista()),
}));
vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) => s(veiculo),
}));
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: Object.assign(
    (s: (e: unknown) => unknown) => s({ cfg, carregado: true, erro: false }),
    { getState: () => ({ cfg }) },
  ),
}));
vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const Cartoes = (await import("./Cartoes")).default;

// O mês exibido está fixo em agosto/2026 nos mocks; o relógio tem de o
// acompanhar, senão "(em formação)" — que compara o mês exibido com o de hoje —
// mudava de resposta conforme o dia em que a suíte corre.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  cfg = { ...CONFIG_PADRAO, contasCartoes: [CARTAO], tipoCartao: { [CARTAO]: "credit" } };
  despesas = lista<DespesaCorrente>();
  transferencias = lista<Transferencia>();
  veiculo = veiculoVazio();
});

describe("Cartoes", () => {
  test("monta e mostra os KPIs da fatura", () => {
    render(<Cartoes />);
    expect(screen.getByRole("heading", { name: "Cartões" })).toBeInTheDocument();
    expect(screen.getByText("A pagar este mês")).toBeInTheDocument();
  });

  test("sem contas configuradas: convida a adicionar a primeira", () => {
    cfg = { ...CONFIG_PADRAO, contasCartoes: [], tipoCartao: {} };
    render(<Cartoes />);
    expect(screen.getByText("Nenhuma conta ou cartão")).toBeInTheDocument();
  });

  test("com conta: mostra o quadro dela", () => {
    render(<Cartoes />);
    // O nome aparece duas vezes na página — no quadro da conta e na chip do
    // painel de gerir contas lá em baixo. Aqui interessa o quadro, que é o
    // botão que abre os detalhes. (Nada de `new RegExp(nome)`: os parênteses
    // do nome virariam grupo de captura e deixavam de casar com o literal.)
    const quadros = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes(CARTAO) && b.textContent?.includes("crédito"));
    expect(quadros).toHaveLength(1);
  });

  test("falha num domínio que alimenta os valores levanta o aviso", () => {
    // Era o buraco: só o erro das transferências estava a ser verificado, e as
    // faturas vêm dos outros cinco.
    despesas = listaComErro<DespesaCorrente>();
    render(<Cartoes />);
    expect(screen.getByText(/Alguns valores não sincronizaram/)).toBeInTheDocument();
  });

  test("o aviso também apanha a falha do veículo", () => {
    veiculo = { ...veiculoVazio(), erro: true };
    render(<Cartoes />);
    expect(screen.getByText(/Alguns valores não sincronizaram/)).toBeInTheDocument();
  });

  test("sem transferências no mês: estado vazio próprio da secção", () => {
    render(<Cartoes />);
    expect(screen.getByText(/Nenhuma transferência em agosto 2026/)).toBeInTheDocument();
  });

  // Os três valores da mesma "fatura" que a auditoria apanhou: o gasto do mês
  // no quadro do cartão (299,97 no exemplo), o "Em aberto" (360,99) e o valor
  // do sino (499,97). Eram janelas de tempo diferentes, nenhuma delas dita em
  // lado nenhum. Agora cada número traz o mês da fatura a que pertence, e o do
  // sino — a fatura do ciclo em curso — passa a estar na tela.
  test("cada valor do cartão diz de que fatura é", () => {
    despesas = lista<DespesaCorrente>([
      // Ciclo de julho → fatura de agosto, a que se paga agora.
      {
        id: "d1",
        descricao: "Mercado",
        valor: 10000,
        data: "2026-07-10",
        categoria: "Alimentação",
        contaCartao: CARTAO,
      },
      // Ciclo de agosto → fatura de setembro, ainda em formação.
      {
        id: "d2",
        descricao: "Café",
        valor: 2500,
        data: "2026-08-05",
        categoria: "Alimentação",
        contaCartao: CARTAO,
      },
    ]);
    render(<Cartoes />);
    const quadro = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Fatura de agosto 2026 · a pagar"))!;
    expect(quadro.textContent).toContain("Fatura de agosto 2026 · a pagar€ 100,00");
    expect(quadro.textContent).toContain("Fatura de setembro 2026 (em formação): € 25,00");
  });

  // A hierarquia invertida do quadro de débito: o movimento do mês (−57,00 no
  // exemplo da auditoria) vinha grande e o saldo de 4.657,00 pequeno, o que faz
  // uma conta com dinheiro parecer negativa.
  test("na conta de débito o saldo é a manchete e o gasto do mês o detalhe", () => {
    cfg = {
      ...CONFIG_PADRAO,
      contasCartoes: [CONTA],
      tipoCartao: { [CONTA]: "debit" },
      saldosIniciais: { [CONTA]: 471400 },
    };
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Cinema",
        valor: 5700,
        data: "2026-08-12",
        categoria: "Lazer",
        contaCartao: CONTA,
      },
    ]);
    render(<Cartoes />);
    const quadro = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Saldo atual"))!;
    // O saldo vem antes do gasto no texto do quadro — é ele a manchete.
    expect(quadro.textContent).toMatch(/Saldo atual€ 4\.657,00Gasto em agosto 2026: € 57,00/);
  });

  test("gasto negativo do mês é dito como devolução, não como saldo a menos", () => {
    cfg = {
      ...CONFIG_PADRAO,
      contasCartoes: [CONTA],
      tipoCartao: { [CONTA]: "debit" },
      saldosIniciais: { [CONTA]: 100000 },
    };
    despesas = lista<DespesaCorrente>([
      {
        id: "d1",
        descricao: "Reembolso do jantar",
        valor: -7500,
        data: "2026-08-16",
        categoria: "Restaurante",
        contaCartao: CONTA,
        origem: "reemb",
      },
    ]);
    render(<Cartoes />);
    expect(screen.getByText("Devolvido em agosto 2026: € 75,00")).toBeInTheDocument();
  });

  // O centro da Fase C: renomear passou a mexer num campo só (o nome da
  // instituição) e a NÃO tocar em lançamento nenhum. Só funciona porque toda a
  // tela que mostra "de que conta é isto" resolve o nome de hoje a partir do id
  // que ficou gravado. Sem isso, um cartão renomeado continuava a aparecer com
  // o nome antigo em todo o histórico — e a tela de Cartões seria o único sítio
  // do app a saber do nome novo.
  describe("depois de renomear", () => {
    beforeEach(() => {
      // O id continua a ser "AB Gold (C)" — é o que os lançamentos guardam.
      cfg = {
        ...CONFIG_PADRAO,
        ...comInstituicoes(instituicao("Gold Novo", "credito", { id: CARTAO })),
      };
      transferencias = lista<Transferencia>([
        {
          id: "t1",
          data: "2026-08-10",
          de: CARTAO,
          para: CARTAO,
          valor: 5000,
        },
      ]);
    });

    test("o quadro da conta mostra o nome novo", () => {
      render(<Cartoes />);
      const quadro = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("crédito") && b.textContent?.includes("Gold Novo"));
      expect(quadro).toBeDefined();
      expect(screen.queryByText(CARTAO)).toBeNull();
    });

    test("uma transferência já lançada mostra o nome novo nas duas pontas", () => {
      render(<Cartoes />);
      const linha = screen.getAllByRole("button").find((b) => b.textContent?.includes("10/08"))!;
      expect(linha.textContent).toContain("Gold Novo");
      expect(linha.textContent).not.toContain(CARTAO);
    });

    // Item 2 do lote de UX/nav (30/08): a linha inteira abre o menu único de
    // ações, em vez de ir direto pro formulário de edição.
    test("tocar na linha da transferência abre o menu com Editar e Excluir", async () => {
      render(<Cartoes />);
      const linha = screen.getAllByRole("button").find((b) => b.textContent?.includes("10/08"))!;

      fireEvent.click(linha);

      expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    });
  });

  test("'Transferências entre contas' é cabeçalho de secção", () => {
    render(<Cartoes />);
    expect(
      screen.getByRole("heading", { name: "Transferências entre contas" }),
    ).toBeInTheDocument();
  });

  // Fase C2: uma instituição já migrada 1:1 pode ganhar um 2º método sem
  // precisar de virar uma conta nova — o cartão de crédito que falta ao lado
  // da conta de débito do mesmo banco.
  describe("adicionar método a uma instituição existente", () => {
    beforeEach(() => {
      cfg = { ...CONFIG_PADRAO, ...comInstituicoes(instituicao(CARTAO, "credito")) };
    });

    // As ações da pílula vivem no menu "⋯" desde 31/08 (dois/três ícones
    // colados nunca chegavam aos 44 pontos de largura de toque).
    function abrirAdicionarMetodo() {
      fireEvent.click(screen.getByRole("button", { name: `Ações de ${CARTAO}` }));
      fireEvent.click(screen.getByRole("button", { name: "Adicionar método" }));
    }

    test("ação no menu do chip abre a folha com o nome da instituição, sem pedir nome", () => {
      render(<Cartoes />);
      abrirAdicionarMetodo();
      expect(
        screen.getByRole("heading", { name: `Adicionar método — ${CARTAO}` }),
      ).toBeInTheDocument();
    });

    test("submeter chama adicionarMetodo com o id da instituição e o tipo escolhido", () => {
      render(<Cartoes />);
      abrirAdicionarMetodo();
      // O tipo já nasce em "Crédito" (padrão do formulário) — não precisa de
      // trocar nada para este teste, só confirmar.
      fireEvent.click(screen.getByRole("button", { name: "Adicionar método" }));
      expect(adicionarMetodo).toHaveBeenCalledWith("u1", cfg, CARTAO, "credit");
    });
  });

  // Fase C4: ao abrir "Pagar", a origem sugerida passa a ser o débito da
  // MESMA instituição do cartão, não sempre a primeira conta de débito.
  describe("sugerir débito ao pagar fatura", () => {
    const CREDITO = "Banco X Crédito";

    beforeEach(() => {
      cfg = {
        ...CONFIG_PADRAO,
        // "Banco Y" vem PRIMEIRO na lista — seria o palpite antigo
        // (`contasDebito[0]`) se a Fase C4 não escolhesse pela instituição.
        ...comInstituicoes(instituicao("Banco Y", "debito"), {
          id: "Banco X",
          nome: "Banco X",
          metodos: [
            { id: "Banco X", tipo: "debito" },
            { id: CREDITO, tipo: "credito" },
          ],
        }),
      };
      despesas = lista<DespesaCorrente>([
        {
          id: "d1",
          descricao: "Compra",
          valor: 5000,
          data: "2026-07-10",
          categoria: "Alimentação",
          contaCartao: CREDITO,
        },
      ]);
    });

    test("sugere o débito do mesmo banco do cartão, não o primeiro da lista", () => {
      render(<Cartoes />);
      const quadro = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("Banco X · Crédito"))!;
      fireEvent.click(quadro);
      fireEvent.click(screen.getByRole("button", { name: "Pagar" }));
      const gatilho = screen.getByRole("button", { name: /^Sai de/ });
      expect(gatilho.textContent).toContain("Banco X · Débito");
    });
  });
});
