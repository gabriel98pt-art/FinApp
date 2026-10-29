// @vitest-environment jsdom

// Cartões calcula o valor das faturas a partir de cinco domínios. O aviso de
// sincronização é o que impede um "Devido no mês" MENOR do que o real de
// passar por número certo — e uma fatura que parece mais barata leva a pagar
// a menos, coisa que só se descobre no mês seguinte.

import { afterAll, describe, expect, test, vi, beforeEach } from "vitest";
import { render as renderRtl, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
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
// Criar/renomear/remover/adicionar método/dias de fatura saíram desta tela em
// 01/09/2026 — vivem agora em Definições, e são testados lá
// (`definicoes/FolhaContasCartoes.test.tsx`). Aqui ficam só os dois serviços
// que Cartões continua a chamar.
vi.mock("../services/cfgService", () => ({
  definirFaturaManual: vi.fn(async () => {}),
  definirSaldoInicial: vi.fn(async () => {}),
}));

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

// Cartões lê o `state` da rota (as rotas antigas de Transações/Parcelas/Importar
// redirecionam para cá).
const render = (ui: ReactElement) => renderRtl(<MemoryRouter>{ui}</MemoryRouter>);

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
  test("monta e mostra a lista de cartões e contas", () => {
    render(<Cartoes />);
    expect(screen.getByRole("heading", { name: "Cartões" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cartões e contas" })).toBeInTheDocument();
  });

  test("Esconder recolhe a lista numa linha e Mostrar traz-a de volta", () => {
    render(<Cartoes />);
    fireEvent.click(screen.getByRole("button", { name: /Esconder/ }));
    expect(
      screen.queryByRole("button", { name: new RegExp(CARTAO.replace(/[()]/g, ".")) }),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: /1 escondidos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mostrar/ }));
    expect(screen.getByRole("button", { name: /Fatura/ })).toBeInTheDocument();
  });

  test("sem contas configuradas: convida a adicionar a primeira", () => {
    cfg = { ...CONFIG_PADRAO, contasCartoes: [], tipoCartao: {} };
    render(<Cartoes />);
    expect(screen.getByText("Nenhuma conta ou cartão")).toBeInTheDocument();
  });

  test("com conta: mostra a linha dela", () => {
    render(<Cartoes />);
    // A linha é o botão que abre os detalhes. (Nada de `new RegExp(nome)`: os
    // parênteses do nome virariam grupo de captura e deixavam de casar com o
    // literal.)
    const linhas = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes(CARTAO) && b.textContent?.includes("Fatura"));
    expect(linhas).toHaveLength(1);
  });

  test("crédito mostra o fecho e o vencimento quando existem", () => {
    cfg = { ...cfg, diaFechamentoFatura: { [CARTAO]: 5 }, diaVencimentoFatura: { [CARTAO]: 12 } };
    render(<Cartoes />);
    expect(screen.getByText("Fatura · fecha dia 5 · vence dia 12")).toBeInTheDocument();
  });

  // 01/09/2026: a gestão das contas (pílulas + menu "⋯" + dias de fatura) saiu
  // daqui inteira para Definições. Esta tela ficou só com o que se LÊ.
  test("não gere mais contas: a seção e as ações dela saíram da tela", () => {
    render(<Cartoes />);
    expect(screen.queryByRole("button", { name: `Ações de ${CARTAO}` })).toBeNull();
    expect(screen.queryByLabelText(/Dia de fechamento da fatura/)).toBeNull();
    expect(screen.queryByLabelText(/Dia de vencimento da fatura/)).toBeNull();
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
    const linha = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes(CARTAO) && b.textContent?.includes("a pagar"))!;
    expect(linha.textContent?.replace(/\u00a0/g, " ")).toContain("€ 100,00a pagar");
    // Abrir a linha diz de que fatura é cada valor.
    fireEvent.click(linha);
    expect(screen.getByText("Fatura de agosto 2026")).toBeInTheDocument();
    expect(screen.getByText("Fatura de setembro 2026 (em formação)")).toBeInTheDocument();
  });

  // A conta de débito mostra o SALDO (4.657,00 no exemplo da auditoria), nunca o
  // movimento do mês (−57,00), que fazia uma conta com dinheiro parecer negativa.
  test("na conta de débito a linha mostra o saldo de hoje", () => {
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
    const linha = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Saldo de hoje"))!;
    expect(linha.textContent?.replace(/\u00a0/g, " ")).toContain("€ 4.657,00");
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

    test("a linha da conta mostra o nome novo", () => {
      render(<Cartoes />);
      const linha = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("Fatura") && b.textContent?.includes("Gold Novo"));
      expect(linha).toBeDefined();
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
