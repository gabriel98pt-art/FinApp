// @vitest-environment jsdom

// O formulário de registo rápido, do ponto de vista do reembolso.
//
// O que se protege aqui é a tradução entre o que a pessoa escreve e o que fica
// guardado: ela escreve 75 (positivo, como o dinheiro que recebeu de volta) e
// o app tem de gravar -75 com origem "reemb". Se essa negação se perder, o
// reembolso passa a SOMAR à despesa em vez de a reduzir — o jantar de 100 €
// vira 175 € e ninguém percebe porquê.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DespesaCorrente } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import { lista, veiculoVazio } from "../testes/dobras";

vi.mock("../services/firebase", () => ({ db: {}, auth: {} }));

const criarDespesa = vi.fn(async () => "novo");
const atualizarDespesa = vi.fn(async () => {});
const criarReceita = vi.fn(async () => "novo");

vi.mock("../services/lancamentosService", () => ({
  criarDespesa: (...a: unknown[]) => criarDespesa(...(a as [])),
  atualizarDespesa: (...a: unknown[]) => atualizarDespesa(...(a as [])),
  criarReceita: (...a: unknown[]) => criarReceita(...(a as [])),
  atualizarReceita: vi.fn(async () => {}),
  removerDespesa: vi.fn(async () => {}),
  removerReceita: vi.fn(async () => {}),
}));
const criarCarga = vi.fn(async () => {});
vi.mock("../services/veiculoService", () => ({
  criarCarga: (...a: unknown[]) => criarCarga(...(a as [])),
  criarDespesaVeiculo: vi.fn(async () => {}),
}));
vi.mock("../services/parcelasService", () => ({ criarParcela: vi.fn(async () => {}) }));

let despesas = lista<DespesaCorrente>();
let estadoUi = {
  registroAberto: true,
  registroTipo: "despesa" as const,
  editandoId: null as string | null,
  abrirRegistro: vi.fn(),
  fecharRegistro: vi.fn(),
};

vi.mock("../stores/uiStore", () => ({
  useUiStore: Object.assign((s?: (e: unknown) => unknown) => (s ? s(estadoUi) : estadoUi), {
    getState: () => estadoUi,
  }),
}));
vi.mock("../stores/lancamentosStore", () => ({
  useDespesasStore: (s: (e: unknown) => unknown) => s(despesas),
  useReceitasStore: (s: (e: unknown) => unknown) => s(lista()),
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
vi.mock("../stores/toastStore", () => ({ mostrarToast: vi.fn() }));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (s: (e: unknown) => unknown) => s({ sessao: { uid: "u1" } }),
}));
vi.mock("../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

const RegistroRapido = (await import("./RegistroRapido")).default;

/** Preenche o mínimo e ESPERA que o valor tenha assentado no campo.
 *
 *  A espera não é cerimónia: o `CampoMoeda` é controlado e reconstrói o texto
 *  a cada tecla. Sem confirmar que a última chegou, o clique em Salvar podia
 *  cair com o valor ainda a null, a validação barrava o submit e o teste
 *  falhava com "undefined is not iterable" — a apontar para o mock em vez de
 *  para a causa. Falhava uma vez em cada três, e só na suite completa, que é
 *  o pior tipo de teste que há. */
async function preencher(centavos: string) {
  await userEvent.type(screen.getByLabelText(/Descrição|Nome/i), "Jantar de equipa");
  const campoValor = screen.getByLabelText(/Valor/i);
  await userEvent.clear(campoValor);
  await userEvent.type(campoValor, centavos);

  // O CampoMoeda mostra só o número ("75,00"), sem símbolo — o símbolo vive no
  // rótulo ao lado.
  const esperado = (Number(centavos) / 100).toFixed(2).replace(".", ",");
  await waitFor(() => expect(campoValor).toHaveValue(esperado));
}

/** Submete e espera a gravação — que é assíncrona dentro do `salvar`. */
async function submeter() {
  await userEvent.click(screen.getByRole("button", { name: /Salvar|Adicionar/i }));
  await waitFor(() => expect(criarDespesa).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  despesas = lista<DespesaCorrente>();
  estadoUi = { ...estadoUi, editandoId: null, registroTipo: "despesa" };
  cfg = CONFIG_PADRAO;
  criarDespesa.mockClear();
  atualizarDespesa.mockClear();
  criarCarga.mockClear();
});

describe("segmentado Despesa / Reembolso", () => {
  test("aparece do lado da despesa, e começa em Despesa", () => {
    render(<RegistroRapido />);

    const grupo = screen.getByRole("radiogroup", { name: "Natureza" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Gasto", checked: true })).toBeInTheDocument();
  });

  test("o seletor de despesa de origem só aparece com Reembolso escolhido", async () => {
    render(<RegistroRapido />);

    expect(
      screen.queryByRole("button", { name: /Reembolso de qual despesa/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Reembolso" }));
    expect(screen.getByRole("button", { name: /Reembolso de qual despesa/ })).toBeInTheDocument();
  });

  test("escolher Reembolso desmarca E esconde Parcelada", async () => {
    // Um reembolso não se parcela. Não basta desmarcar: com o interruptor
    // ainda à mão, marcá-lo depois fazia o submit cair no ramo da parcela —
    // que ignora a `origem` e o sinal — e o reembolso desaparecia sem aviso.
    render(<RegistroRapido />);

    await userEvent.click(screen.getByRole("checkbox", { name: /Parcelada/ }));
    expect(screen.getByRole("checkbox", { name: /Parcelada/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(screen.getByRole("radio", { name: "Reembolso" }));
    expect(screen.queryByRole("checkbox", { name: /Parcelada/ })).not.toBeInTheDocument();

    // E volta quando se escolhe Gasto outra vez, desmarcada.
    await userEvent.click(screen.getByRole("radio", { name: "Gasto" }));
    expect(screen.getByRole("checkbox", { name: /Parcelada/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("não aparece do lado da receita", () => {
    // Uma receita já é dinheiro a entrar; um "reembolso de receita" não
    // significa nada neste modelo.
    estadoUi = { ...estadoUi, registroTipo: "receita" as never };
    render(<RegistroRapido />);

    expect(screen.queryByRole("radiogroup", { name: "Natureza" })).not.toBeInTheDocument();
  });
});

describe("gravação do reembolso", () => {
  test("o valor escrito em positivo é gravado NEGATIVO, com origem reemb", async () => {
    render(<RegistroRapido />);

    await userEvent.click(screen.getByRole("radio", { name: "Reembolso" }));
    await preencher("7500");
    await submeter();

    const [, dados] = criarDespesa.mock.calls[0] as unknown as [string, DespesaCorrente];
    // 75,00 escritos → -7500 guardados. É esta negação que faz a categoria
    // netar sozinha no donut, no orçamento e nos KPIs.
    expect(dados.valor).toBe(-7500);
    expect(dados.origem).toBe("reemb");
  });

  test("uma despesa normal continua positiva e sem origem", async () => {
    render(<RegistroRapido />);

    await preencher("4250");
    await submeter();

    const [, dados] = criarDespesa.mock.calls[0] as unknown as [string, DespesaCorrente];
    expect(dados.valor).toBe(4250);
    expect(dados.origem).toBeUndefined();
  });

  test("sem escolher despesa de origem, grava na mesma (o vínculo é opcional)", async () => {
    render(<RegistroRapido />);

    await userEvent.click(screen.getByRole("radio", { name: "Reembolso" }));
    await preencher("7500");
    await submeter();

    const [, dados] = criarDespesa.mock.calls[0] as unknown as [string, DespesaCorrente];
    expect(dados.reembolsoDeId).toBeUndefined();
    expect(dados.valor).toBe(-7500);
  });
});

// Item B1: o sub-formulário de carga mostra kWh, litros, ou os dois (com
// escolha) conforme o tipo de veículo configurado — não é mais sempre kWh.
describe("abastecimento — campos conforme o tipo de veículo (item B1)", () => {
  beforeEach(() => {
    estadoUi = { ...estadoUi, registroTipo: "carga" as never };
  });

  test("elétrico (default): só kWh, sem toggle de dimensão", () => {
    render(<RegistroRapido />);

    expect(screen.getByLabelText("kWh")).toBeInTheDocument();
    expect(screen.queryByLabelText("Litros")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Elétrico ou combustível" })).toBeNull();
  });

  test("combustão: só litros, sem toggle de dimensão", () => {
    cfg = { ...CONFIG_PADRAO, tipoVeiculo: "combustao" };
    render(<RegistroRapido />);

    expect(screen.getByLabelText("Litros")).toBeInTheDocument();
    expect(screen.queryByLabelText("kWh")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Elétrico ou combustível" })).toBeNull();
  });

  test("híbrido: toggle aparece, começa em Elétrico, e troca o campo ao clicar", async () => {
    cfg = { ...CONFIG_PADRAO, tipoVeiculo: "hibrido" };
    render(<RegistroRapido />);

    expect(screen.getByLabelText("kWh")).toBeInTheDocument();
    const toggle = screen.getByRole("radiogroup", { name: "Elétrico ou combustível" });
    expect(toggle).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Combustível" }));

    expect(screen.getByLabelText("Litros")).toBeInTheDocument();
    expect(screen.queryByLabelText("kWh")).not.toBeInTheDocument();
    // Sessão é conceito só do carregamento elétrico — some ao trocar.
    expect(screen.queryByLabelText("Sessão (opcional)")).not.toBeInTheDocument();
  });

  test("elétrico/combustão puro não tem campo Sessão fora do elétrico", () => {
    cfg = { ...CONFIG_PADRAO, tipoVeiculo: "combustao" };
    render(<RegistroRapido />);
    expect(screen.queryByLabelText("Sessão (opcional)")).not.toBeInTheDocument();
  });
});

describe("erro de validação — achado da auditoria de Acessibilidade", () => {
  test("valor zero associa o campo de valor ao erro via aria-describedby", async () => {
    render(<RegistroRapido />);

    // "0,00" passa a validação HTML5 required (não está vazio) mas falha a
    // checagem de JS (valor <= 0) — é o único jeito de chegar no erro sem o
    // navegador bloquear o submit antes.
    await preencher("0");
    await userEvent.click(screen.getByRole("button", { name: /Salvar|Adicionar/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Valor inválido");
    expect(criarDespesa).not.toHaveBeenCalled();

    const idErro = alerta.id;
    expect(idErro).toBeTruthy();
    expect(screen.getByLabelText(/Valor/i)).toHaveAttribute("aria-describedby", idErro);
  });
});

describe("nº de parcelas — atalhos e o seletor 'Outro número'", () => {
  // Com "Parcelada" marcada apareciam os atalhos 3x/6x/9x/12x E, logo abaixo,
  // um seletor "Outro número de parcelas" já a mostrar "3x". Os dois pareciam
  // dois controlos a mandar no mesmo número ao mesmo tempo.
  test("com um atalho aceso, o seletor não mostra número nenhum", async () => {
    render(<RegistroRapido />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Parcelada/ }));

    expect(screen.getByRole("button", { name: "3x", pressed: true })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Outro número de parcelas.*Escolher/ }),
    ).toBeInTheDocument();
  });

  test("o seletor só oferece números que os atalhos não cobrem", async () => {
    render(<RegistroRapido />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Parcelada/ }));
    await userEvent.click(screen.getByRole("button", { name: /Outro número de parcelas/ }));

    const folha = screen.getByRole("dialog", { name: "Outro número de parcelas" });
    const opcoes = within(folha)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(opcoes).toContain("2x");
    expect(opcoes).toContain("5x");
    expect(opcoes).not.toContain("3x");
    expect(opcoes).not.toContain("12x");
  });
});

// O módulo Veículo pode ser desligado (Definições › Veículo). Ligado é o
// estado normal — só quem não tem carro o desliga — e então o terceiro botão
// do seletor de tipo tem de sair daqui também, senão o registro rápido
// continuava a abrir um formulário cuja tela já não existe na navegação.
describe("módulo Veículo desligado", () => {
  test("ligado (padrão): o botão Veículo está no seletor de tipo", () => {
    render(<RegistroRapido />);
    const grupo = screen.getByRole("radiogroup", { name: "Tipo de lançamento" });
    expect(within(grupo).getByRole("radio", { name: "Veículo" })).toBeInTheDocument();
  });

  test("desligado: o botão Veículo some, Despesa e Receita ficam", () => {
    cfg = { ...CONFIG_PADRAO, showVeiculo: false };
    render(<RegistroRapido />);

    const grupo = screen.getByRole("radiogroup", { name: "Tipo de lançamento" });
    expect(within(grupo).queryByRole("radio", { name: "Veículo" })).not.toBeInTheDocument();
    expect(within(grupo).getByRole("radio", { name: "Despesa" })).toBeInTheDocument();
    expect(within(grupo).getByRole("radio", { name: "Receita" })).toBeInTheDocument();
  });
});
