// @vitest-environment jsdom

// A gestão de contas e cartões mudou-se inteira da tela de Cartões para cá:
// criar (31/08/2026) e, desde 01/09/2026, também renomear, remover, juntar um
// 2.º método à mesma instituição e acertar os dias da fatura.
//
// O que se testa é exatamente o que se perdeu ao sair de Cartões: cada ação
// continua a chamar o mesmo serviço, com os mesmos argumentos. Os testes de
// renomear/remover/adicionar método vieram de `Cartoes.test.tsx`.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import { comInstituicoes, instituicao } from "../../testes/instituicoes";
import type { ConfigConta } from "../../types";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
const adicionarCartao = vi.fn(async () => {});
const adicionarMetodo = vi.fn(async () => {});
const removerCartao = vi.fn(async () => {});
const renomearCartao = vi.fn(async () => {});
const definirDiaFechamentoFatura = vi.fn(async () => {});
const definirDiaVencimentoFatura = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({
  adicionarCartao: (...a: unknown[]) => adicionarCartao(...(a as [])),
  adicionarMetodo: (...a: unknown[]) => adicionarMetodo(...(a as [])),
  removerCartao: (...a: unknown[]) => removerCartao(...(a as [])),
  renomearCartao: (...a: unknown[]) => renomearCartao(...(a as [])),
  definirDiaFechamentoFatura: (...a: unknown[]) => definirDiaFechamentoFatura(...(a as [])),
  definirDiaVencimentoFatura: (...a: unknown[]) => definirDiaVencimentoFatura(...(a as [])),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const FolhaContasCartoes = (await import("./FolhaContasCartoes")).default;

const CARTAO = "AB Gold (C)";

function abrir(cfg: ConfigConta = CONFIG_PADRAO) {
  return render(<FolhaContasCartoes cfg={cfg} uid="u1" aberta aoFechar={() => {}} />);
}

beforeEach(() => {
  adicionarCartao.mockClear();
  adicionarMetodo.mockClear();
  removerCartao.mockClear();
  renomearCartao.mockClear();
  definirDiaFechamentoFatura.mockClear();
  definirDiaVencimentoFatura.mockClear();
});

describe("FolhaContasCartoes — criar", () => {
  test("cria com o tipo crédito por omissão", async () => {
    abrir();
    await userEvent.type(screen.getByLabelText("Nome da conta ou cartão"), "AB Gold");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta ou cartão" }));
    expect(adicionarCartao).toHaveBeenCalledWith("u1", CONFIG_PADRAO, "AB Gold", "credit");
  });

  test("troca pra débito antes de criar", async () => {
    abrir();
    await userEvent.type(screen.getByLabelText("Nome da conta ou cartão"), "Conta Principal");
    await userEvent.click(screen.getByRole("button", { name: /Tipo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Débito" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta ou cartão" }));
    expect(adicionarCartao).toHaveBeenCalledWith("u1", CONFIG_PADRAO, "Conta Principal", "debit");
  });

  test("nome vazio não chama o serviço", async () => {
    abrir();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta ou cartão" }));
    expect(adicionarCartao).not.toHaveBeenCalled();
  });

  test("limpa o nome depois de criar", async () => {
    abrir();
    const campo = screen.getByLabelText("Nome da conta ou cartão");
    await userEvent.type(campo, "AB Gold");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta ou cartão" }));
    expect(campo).toHaveValue("");
  });
});

describe("FolhaContasCartoes — lista do que já existe", () => {
  const cfgCredito: ConfigConta = {
    ...CONFIG_PADRAO,
    ...comInstituicoes(instituicao(CARTAO, "credito")),
  };

  test("lista cada conta com o tipo ao lado", () => {
    abrir({
      ...CONFIG_PADRAO,
      ...comInstituicoes(instituicao(CARTAO, "credito"), instituicao("Conta Principal", "debito")),
    });
    expect(screen.getByText(CARTAO)).toBeInTheDocument();
    expect(screen.getByText("Conta Principal")).toBeInTheDocument();
    expect(screen.getByText("crédito")).toBeInTheDocument();
    expect(screen.getByText("débito")).toBeInTheDocument();
  });

  // O id continua a ser o antigo — é o que os lançamentos guardam —, mas a
  // lista tem de mostrar o nome de hoje, como já mostrava em Cartões.
  test("mostra o nome de hoje, não o id gravado", () => {
    abrir({
      ...CONFIG_PADRAO,
      ...comInstituicoes(instituicao("Gold Novo", "credito", { id: CARTAO })),
    });
    expect(screen.getByText("Gold Novo")).toBeInTheDocument();
    expect(screen.queryByText(CARTAO)).toBeNull();
  });

  test("renomear chama renomearCartao com o id do método", async () => {
    abrir(cfgCredito);
    fireEvent.click(screen.getByRole("button", { name: `Renomear ${CARTAO}` }));
    const campo = await screen.findByLabelText("Nome novo");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Gold Novo");
    // Nome exato: o botão da linha chama-se "Renomear AB Gold (C)", este é o
    // de submeter a folha.
    await userEvent.click(screen.getByRole("button", { name: "Renomear" }));
    expect(renomearCartao).toHaveBeenCalledWith("u1", cfgCredito, CARTAO, "Gold Novo");
  });

  test("remover chama removerCartao depois de confirmar", async () => {
    abrir(cfgCredito);
    fireEvent.click(screen.getByRole("button", { name: `Remover ${CARTAO}` }));
    await vi.waitFor(() => expect(removerCartao).toHaveBeenCalledWith("u1", cfgCredito, CARTAO));
  });

  // Fase C2: uma instituição já migrada 1:1 pode ganhar um 2.º método sem
  // precisar de virar uma conta nova — o cartão de crédito que falta ao lado
  // da conta de débito do mesmo banco.
  test("adicionar método abre a folha com o nome da instituição, sem pedir nome", () => {
    abrir(cfgCredito);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar método em ${CARTAO}` }));
    expect(
      screen.getByRole("heading", { name: `Adicionar método — ${CARTAO}` }),
    ).toBeInTheDocument();
  });

  test("submeter chama adicionarMetodo com o id da instituição e o tipo escolhido", () => {
    abrir(cfgCredito);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar método em ${CARTAO}` }));
    // O tipo já nasce em "Crédito" (padrão do formulário) — não precisa de
    // trocar nada para este teste, só confirmar.
    fireEvent.click(screen.getByRole("button", { name: "Adicionar método" }));
    expect(adicionarMetodo).toHaveBeenCalledWith("u1", cfgCredito, CARTAO, "credit");
  });

  test("só o cartão de crédito mostra os dias da fatura", () => {
    abrir({ ...CONFIG_PADRAO, ...comInstituicoes(instituicao("Conta Principal", "debito")) });
    expect(screen.queryByLabelText(/Dia de vencimento/)).toBeNull();
  });

  test("escrever o dia de fechamento guarda o número", () => {
    abrir(cfgCredito);
    fireEvent.change(screen.getByLabelText(/Dia de fechamento da fatura/), {
      target: { value: "20" },
    });
    expect(definirDiaFechamentoFatura).toHaveBeenCalledWith("u1", cfgCredito, CARTAO, 20);
  });

  // Sem dígito nenhum, o campo volta a `null` — é assim que se apaga o dia,
  // igual ao que a pílula de Cartões fazia.
  test("dia de vencimento sem número nenhum guarda null", () => {
    abrir(cfgCredito);
    fireEvent.change(screen.getByLabelText(/Dia de vencimento da fatura/), {
      target: { value: "—" },
    });
    expect(definirDiaVencimentoFatura).toHaveBeenCalledWith("u1", cfgCredito, CARTAO, null);
  });
});
