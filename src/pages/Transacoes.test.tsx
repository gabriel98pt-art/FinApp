// @vitest-environment jsdom

// Transações é o extrato que junta seis domínios. O teste que interessa aqui
// é o do estado de erro: esta página chegou a afirmar "Nada movimentado em
// <mês>" quando o que havia era falha de rede, porque o syncService marca
// `carregado: true` junto com `erro: true`. A regressão é silenciosa — a tela
// fica bonita e mente —, por isso fica presa por teste.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DespesaCorrente, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { KPIS_POR_PAGINA } from "../constants/kpis";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

/** Estado de uma store de lista, com tudo carregado e sem erro por omissão. */
const lista = <T,>(itens: T[] = []) => ({ itens, carregado: true, erro: false });

let receitas = lista<Receita>();
let despesas = lista<DespesaCorrente>();
let vazias = lista();

vi.mock("../stores/lancamentosStore", () => ({
  useReceitasStore: (s: (e: unknown) => unknown) => s(receitas),
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useDespesasFixasStore: (s: (e: unknown) => unknown) => s(vazias),
  useTransferenciasStore: (s: (e: unknown) => unknown) => s(vazias),
}));

vi.mock("../stores/parcelasStore", () => ({
  useParcelasStore: (s: (e: unknown) => unknown) => s(vazias),
}));

vi.mock("../stores/veiculoStore", () => ({
  useVeiculoStore: (s: (e: unknown) => unknown) =>
    s({ dados: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] }, ...vazias }),
}));

vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) =>
    s({ cfg: CONFIG_PADRAO, carregado: true, erro: false }),
}));

vi.mock("../stores/mesVisivelStore", () => ({
  useMesVisivelStore: (s: (e: unknown) => unknown) => s({ mes: "2026-08" }),
}));

vi.mock("../stores/uiStore", () => ({
  useUiStore: (s: (e: unknown) => unknown) => s({ abrirRegistro: vi.fn() }),
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));

const Transacoes = (await import("./Transacoes")).default;

const desenhar = () =>
  render(
    <MemoryRouter>
      <Transacoes />
    </MemoryRouter>,
  );

beforeEach(() => {
  receitas = lista<Receita>();
  despesas = lista<DespesaCorrente>();
  vazias = lista();
});

describe("Transacoes", () => {
  test("monta e mostra o título", () => {
    desenhar();
    expect(screen.getByRole("heading", { name: "Transações" })).toBeInTheDocument();
  });

  test("mês realmente sem movimento: pode afirmar que está vazio", () => {
    desenhar();
    expect(screen.getByText(/Nada movimentado em agosto 2026/)).toBeInTheDocument();
  });

  test("sincronização caída e sem dados: NÃO diz que nada foi movimentado", () => {
    // O defeito que este ficheiro existe para travar. Sem dados e com a
    // subscrição caída, "Nada movimentado" é uma afirmação categórica sobre
    // dados que nunca chegaram — num app de dinheiro lê-se como perda de
    // registos, não como problema de rede.
    receitas = { ...lista<Receita>(), erro: true };
    desenhar();

    expect(screen.queryByText(/Nada movimentado/)).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("basta UM domínio em erro para o aviso aparecer", () => {
    // O extrato junta seis. Se só se olhasse ao primeiro, uma falha no veículo
    // ou nas parcelas passava em claro e o total ficava menor sem aviso.
    vazias = { ...lista(), erro: true }; // fixas, transferências, parcelas e veículo
    desenhar();
    expect(screen.getByText(/Não foi possível sincronizar/)).toBeInTheDocument();
  });

  test("com linhas na tela, o aviso é a faixa fina e as linhas ficam", () => {
    receitas = { itens: [receita()], carregado: true, erro: true };
    desenhar();

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText(/os dados podem estar desatualizados/)).toBeInTheDocument();
  });

  test("junta receitas e despesas no mesmo extrato, com os sinais certos", () => {
    receitas = lista([receita()]);
    despesas = lista([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("2 transações")).toBeInTheDocument();
  });

  test("reembolso mostra o sinal UMA vez, do lado de quem recebe", () => {
    // Um reembolso é uma despesa de valor NEGATIVO (utils/reembolsos.ts). A
    // linha somava o prefixo da direção ao menos do próprio número e saía
    // "− € -75,00". Dinheiro que voltou é entrada: "+", e o módulo do valor.
    despesas = lista([
      {
        id: "d1",
        descricao: "Jantar de grupo",
        valor: 12000,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
      {
        id: "d2",
        descricao: "Reembolso do jantar",
        valor: -7500,
        data: "2026-08-04",
        categoria: "Alimentação",
        origem: "reemb",
        reembolsoDeId: "d1",
      } as DespesaCorrente,
    ]);
    const { container } = desenhar();

    expect(container.textContent).toContain("+€ 75,00");
    // A saída antiga, letra por letra — o menos duas vezes.
    expect(container.textContent).not.toContain("−€ -75,00");
  });

  test("o terceiro KPI é o saldo do que está à vista, não a contagem de linhas", () => {
    // Contar linhas repetia o "N transações" logo abaixo; o que faltava era
    // saber se o período fecha acima ou abaixo de zero.
    receitas = lista([receita()]);
    despesas = lista([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();

    expect(screen.getByText("Saldo")).toBeInTheDocument();
    expect(screen.queryByText("Movimentações")).not.toBeInTheDocument();
    // 1850,00 de entrada − 42,50 de saída.
    expect(screen.getByText("€ 1.807,50")).toBeInTheDocument();
  });

  test("saldo negativo: gastou-se mais do que entrou no período", () => {
    despesas = lista([
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4250,
        data: "2026-08-03",
        categoria: "Alimentação",
      } as DespesaCorrente,
    ]);
    desenhar();

    expect(screen.getByText("€ -42,50")).toBeInTheDocument();
    // Era "amarelo" — inconsistente com todo o resto do app, onde
    // saldo/variação negativos são sempre "vermelho" (achado da auditoria de
    // Design). O card do Saldo é o `parentElement` do próprio rótulo.
    const card = screen.getByText("Saldo").parentElement!;
    expect(card.style.getPropertyValue("--_a")).toBe("var(--red)");
  });

  test("os três rótulos são os que Definições oferece para o mobile", () => {
    // No telemóvel só cabem 2 dos 3 cartões, e sem entrada em KPIS_POR_PAGINA
    // o Saldo ficava fora do alcance de quem usa o app no telemóvel — não há
    // sequer onde o escolher. A escolha é casada por TEXTO, então os dois lados
    // têm de andar juntos (ver `Kpis` em components/Pagina.tsx).
    desenhar();

    const esperados = KPIS_POR_PAGINA.find((p) => p.id === "transacoes")!.rotulos;
    expect(esperados).toEqual(["Entradas", "Saídas", "Saldo"]);
    for (const rotulo of esperados) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
  });
});

function receita(): Receita {
  return {
    id: "r1",
    descricao: "Salário",
    valor: 185000,
    data: "2026-08-05",
    fonte: "Trabalho",
  };
}
