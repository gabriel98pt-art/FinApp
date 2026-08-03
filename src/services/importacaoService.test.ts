import { beforeEach, describe, expect, test, vi } from "vitest";

// O que interessa aqui é PARA ONDE cada linha vai, não o Firebase: a gravação
// fica trocada por espiões.
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("firebase/database", () => ({
  ref: () => ({}),
  push: () => ({ key: `id-${Math.random().toString(36).slice(2, 8)}` }),
  update: vi.fn(async () => undefined),
}));
// Mock parcial: o resto do módulo (VEICULO_VAZIO e companhia) continua a ser
// preciso por quem o importa mais acima na cadeia.
vi.mock("./lancamentosService", async (original) => ({
  ...(await original<typeof import("./lancamentosService")>()),
  criarTransferencia: vi.fn(async () => "id-transf"),
}));
vi.mock("./veiculoService", async (original) => ({
  ...(await original<typeof import("./veiculoService")>()),
  criarCarga: vi.fn(async () => "id-carga"),
}));
import {
  confirmarImportacao,
  construirExistentes,
  dadosDaCarga,
  dadosDaTransferencia,
} from "./importacaoService";
import { update } from "firebase/database";
import { criarCarga } from "./veiculoService";
import { criarTransferencia } from "./lancamentosService";
import { calcularFaturaAutomatica } from "../utils/fatura";
import { analisarLinha, verificarDuplicata } from "../utils/importacao";
import type {
  CargaEletrica,
  DespesaCorrente,
  DespesaFixa,
  DespesaVeiculo,
  LinhaAnalisada,
  Receita,
  Transferencia,
} from "../types";

// Uma parcela paga e um pagamento de fatura chegam a `despesasCorrentes` com
// `origem` preenchida — era exatamente o que a lista de dedup deixava de fora.
const PARCELA_PAGA: DespesaCorrente = {
  id: "d-parc",
  descricao: "TV Samsung",
  valor: 9990,
  data: "2026-07-10",
  categoria: "Parcelas",
  origem: "parc",
};

const PAGAMENTO_FATURA: DespesaCorrente = {
  id: "d-fat",
  descricao: "Fatura AB Gold",
  valor: 45000,
  data: "2026-07-15",
  categoria: "Cartão de Crédito",
  origem: "fat",
};

const DESPESA_COMUM: DespesaCorrente = {
  id: "d-1",
  descricao: "Continente",
  valor: 1240,
  data: "2026-07-01",
  categoria: "Alimentação",
};

const CARGA: CargaEletrica = {
  id: "v-c1",
  data: "2026-07-08",
  kwh: 30,
  precoKwh: 12,
  custo: 1050,
  local: "Powerdot",
};

const DESPESA_VEICULO: DespesaVeiculo = {
  id: "v-d1",
  data: "2026-07-20",
  valor: 8500,
  categoria: "Manutenção",
  nota: "Norauto",
};

/** Os domínios que a maioria destes testes não usa: veículo e transferências. */
const SO_OS_DOIS: [CargaEletrica[], DespesaVeiculo[], Transferencia[], DespesaFixa[]] = [
  [],
  [],
  [],
  [],
];

describe("construirExistentes", () => {
  test("despesa com origem parc/fat entra na comparação", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA, PAGAMENTO_FATURA], ...SO_OS_DOIS);
    expect(existentes.map((e) => e.id)).toEqual(["d-parc", "d-fat"]);
    // Despesa: valor negativo, para bater com a saída do extrato.
    expect(existentes[0].valor).toBe(-9990);
  });

  test("carga elétrica e despesa do veículo entram, como despesa", () => {
    const existentes = construirExistentes([], [], [CARGA], [DESPESA_VEICULO], [], []);
    expect(existentes).toEqual([
      { id: "v-c1", data: "2026-07-08", valor: -1050, descricao: "Powerdot" },
      { id: "v-d1", data: "2026-07-20", valor: -8500, descricao: "Norauto Manutenção" },
    ]);
  });

  test("despesa do veículo sem nota fica só com a categoria", () => {
    const semNota: DespesaVeiculo = { ...DESPESA_VEICULO, nota: undefined };
    expect(construirExistentes([], [], [], [semNota], [], [])[0].descricao).toBe("Manutenção");
  });

  test("receita continua com o valor positivo", () => {
    const receita: Receita = {
      id: "r1",
      descricao: "Julho",
      valor: 200000,
      data: "2026-07-05",
      fonte: "Salário",
    };
    expect(construirExistentes([receita], [], ...SO_OS_DOIS)[0]).toEqual({
      id: "r1",
      data: "2026-07-05",
      valor: 200000,
      descricao: "Salário Julho",
    });
  });
});

describe("dedup com os lançamentos que faltavam", () => {
  const ctx = {
    parcelas: [],
    categoriasConfiguradas: [],
    existentes: [],
    locaisCarregamento: [],
    cargasHistorico: [],
  };

  test("pagamento da prestação no extrato deixa de passar como novo", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA], ...SO_OS_DOIS);
    // Como o banco escreve: nada a ver com "TV Samsung Parcelas" no texto.
    const linha = { data: "2026-07-10", descricao: "PAG.PRESTACAO N. 009", valor: -9990 };

    // Lista vazia é o que o filtro antigo produzia a partir desta despesa: a
    // linha passava como nova e ia para o histórico uma segunda vez.
    expect(verificarDuplicata(linha, []).status).toBe("new");
    const achado = verificarDuplicata(linha, existentes);
    expect(achado.status).not.toBe("new");
    expect(achado.correspondencia?.id).toBe("d-parc");

    // O efeito que interessa: não vem marcada para importar às cegas.
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("pagamento de fatura do cartão no extrato é apanhado", () => {
    const existentes = construirExistentes([], [PAGAMENTO_FATURA], ...SO_OS_DOIS);
    const linha = { data: "2026-07-15", descricao: "PAGAMENTO CARTAO CREDITO", valor: -45000 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("recarga já lançada na aba Veículo é apanhada — e pelo nome do posto", () => {
    const existentes = construirExistentes([], [], [CARGA], [], [], []);
    const linha = { data: "2026-07-08", descricao: "POWERDOT PORTUGAL", valor: -1050 };
    const analisada = analisarLinha(linha, 0, { ...ctx, existentes });
    expect(analisada.acao).toBe("skip");
    // O nome do posto a bater no texto tira isto do empate por valor+data:
    // vale "duplicate", ainda que só com confiança média — e por isso a linha
    // aparece em "Revisão", que é onde o app põe tudo o que não é certeza.
    expect(analisada.duplicata.status).toBe("duplicate");
    expect(analisada.duplicata.correspondencia?.id).toBe("v-c1");
    expect(analisada.decisao).toBe("revisao");
  });

  test("recarga com o nome do posto igual ao do extrato vira duplicata provável", () => {
    const existentes = construirExistentes([], [], [CARGA], [], [], []);
    const linha = { data: "2026-07-08", descricao: "Powerdot", valor: -1050 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).decisao).toBe("duplicata_provavel");
  });

  test("despesa do veículo já lançada é apanhada pela nota", () => {
    const existentes = construirExistentes([], [], [], [DESPESA_VEICULO], [], []);
    const linha = { data: "2026-07-20", descricao: "NORAUTO MATOSINHOS", valor: -8500 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("despesa nova de verdade continua a entrar como nova", () => {
    const existentes = construirExistentes(
      [],
      [DESPESA_COMUM, PARCELA_PAGA, PAGAMENTO_FATURA],
      [CARGA],
      [DESPESA_VEICULO],
      [],
      [],
    );
    const linha = { data: "2026-07-22", descricao: "Mercadona", valor: -3200 };
    const analisada = analisarLinha(linha, 0, { ...ctx, existentes });
    expect(analisada.duplicata.status).toBe("new");
    expect(analisada.acao).toBe("import");
  });

  test("mesmo valor mas fora da janela de datas não é duplicata", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA], ...SO_OS_DOIS);
    const linha = { data: "2026-08-10", descricao: "PAG.PRESTACAO N. 010", valor: -9990 };
    expect(verificarDuplicata(linha, existentes).status).toBe("new");
  });
});

describe("dadosDaCarga", () => {
  const linhaCarga = (mudancas: Partial<LinhaAnalisada> = {}): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-08",
    descricao: "POWERDOT PORTUGAL",
    valor: -1050,
    classificacao: {
      tipo: "despesa",
      categoria: "Veículo",
      incerto: false,
      confianca: "high",
      motivo: "regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "auto_classificada",
    acao: "import",
    categoriaEscolhida: "Veículo",
    tipoEscolhido: "despesa",
    destino: "carga",
    localCarga: "Powerdot",
    kwhCarga: "10",
    contaOrigem: "",
    contaDestino: "",
    ...mudancas,
  });

  test("monta a carga com o custo da linha e o preço por kWh calculado", () => {
    expect(dadosDaCarga(linhaCarga())).toEqual({
      data: "2026-07-08",
      kwh: 10,
      custo: 1050,
      // 10,50 € por 10 kWh = 105 cêntimos/kWh, a mesma conta do registo rápido.
      precoKwh: 105,
      local: "Powerdot",
    });
  });

  test("aceita kWh escrito com vírgula, como se digita", () => {
    expect(dadosDaCarga(linhaCarga({ kwhCarga: "32,5", valor: -1300 })!)?.kwh).toBe(32.5);
  });

  test("sem local não dá carga nenhuma — é o único campo obrigatório", () => {
    expect(dadosDaCarga(linhaCarga({ localCarga: "  " }))).toBeNull();
  });

  test("sem kWh a carga entra incompleta, em vez de travar a importação", () => {
    // Posto novo, sem histórico para estimar: o valor e a data já valem, e os
    // kWh completam-se depois na aba Veículo.
    for (const kwhCarga of ["", "0", "abc"]) {
      expect(dadosDaCarga(linhaCarga({ kwhCarga }))).toEqual({
        data: "2026-07-08",
        kwh: 0,
        custo: 1050,
        precoKwh: 0,
        local: "Powerdot",
      });
    }
  });
});

describe("confirmarImportacao com recarga", () => {
  const linha = (mudancas: Partial<LinhaAnalisada>): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-08",
    descricao: "POWERDOT PORTUGAL",
    valor: -1050,
    classificacao: {
      tipo: "despesa",
      categoria: "Veículo",
      incerto: false,
      confianca: "high",
      motivo: "regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "auto_classificada",
    acao: "import",
    categoriaEscolhida: "Veículo",
    tipoEscolhido: "despesa",
    destino: "lancamento",
    localCarga: "",
    kwhCarga: "",
    contaOrigem: "",
    contaDestino: "",
    ...mudancas,
  });

  beforeEach(() => {
    vi.mocked(update).mockClear();
    vi.mocked(criarCarga).mockClear();
  });

  test("recarga vai para o veículo e não para despesas correntes", async () => {
    const n = await confirmarImportacao("u1", [
      linha({ destino: "carga", localCarga: "Powerdot", kwhCarga: "10" }),
    ]);

    expect(criarCarga).toHaveBeenCalledWith("u1", {
      data: "2026-07-08",
      kwh: 10,
      custo: 1050,
      precoKwh: 105,
      local: "Powerdot",
    });
    // Nenhuma escrita no lote das despesas/receitas.
    expect(update).not.toHaveBeenCalled();
    expect(n).toBe(1);
  });

  test("cada destino vai para o seu lado, na mesma importação", async () => {
    const n = await confirmarImportacao("u1", [
      linha({ id: 1, destino: "carga", localCarga: "Powerdot", kwhCarga: "10" }),
      linha({ id: 2, descricao: "Mercadona", valor: -3200, categoriaEscolhida: "Alimentação" }),
    ]);

    expect(criarCarga).toHaveBeenCalledTimes(1);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, { descricao: string }>;
    const caminhos = Object.keys(gravado);
    expect(caminhos).toHaveLength(1);
    expect(caminhos[0].startsWith("despesasCorrentes/")).toBe(true);
    expect(Object.values(gravado)[0].descricao).toBe("Mercadona");
    expect(n).toBe(2);
  });

  test("recarga sem local faz falhar antes de gravar seja o que for", async () => {
    await expect(
      confirmarImportacao("u1", [
        linha({ id: 1, descricao: "Mercadona", valor: -3200 }),
        linha({ id: 2, destino: "carga", localCarga: "", kwhCarga: "10" }),
      ]),
    ).rejects.toThrow(/Recarga/);
    expect(update).not.toHaveBeenCalled();
    expect(criarCarga).not.toHaveBeenCalled();
  });

  test("linha marcada para pular não grava em lado nenhum", async () => {
    const n = await confirmarImportacao("u1", [
      linha({ acao: "skip", destino: "carga", localCarga: "Powerdot", kwhCarga: "10" }),
    ]);
    expect(criarCarga).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });
});

describe("transferência vinda de cartão de crédito", () => {
  const linha = (mudancas: Partial<LinhaAnalisada>): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-12",
    descricao: "Transferência de ActivoBank",
    valor: 30000,
    classificacao: {
      tipo: "transferencia",
      categoria: "Transferência",
      incerto: true,
      confianca: "medium",
      motivo: "regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "revisao",
    acao: "import",
    categoriaEscolhida: "Transferência",
    tipoEscolhido: "despesa",
    destino: "transferencia_cartao",
    localCarga: "",
    kwhCarga: "",
    contaOrigem: "AB Gold (C)",
    contaDestino: "Conta Principal",
    ...mudancas,
  });

  beforeEach(() => {
    vi.mocked(update).mockClear();
    vi.mocked(criarCarga).mockClear();
    vi.mocked(criarTransferencia).mockClear();
  });

  test("monta a transferência com valor positivo, como a fatura a soma", () => {
    expect(dadosDaTransferencia(linha({}))).toEqual({
      data: "2026-07-12",
      de: "AB Gold (C)",
      para: "Conta Principal",
      valor: 30000,
      descricao: "Transferência de ActivoBank",
    });
  });

  test("sem cartão, sem conta, ou com as duas iguais, não dá transferência", () => {
    expect(dadosDaTransferencia(linha({ contaOrigem: "" }))).toBeNull();
    expect(dadosDaTransferencia(linha({ contaDestino: " " }))).toBeNull();
    expect(dadosDaTransferencia(linha({ contaDestino: "AB Gold (C)" }))).toBeNull();
  });

  test("ao confirmar não vira receita nenhuma — vai para transferências", async () => {
    const n = await confirmarImportacao("u1", [linha({})]);

    expect(criarTransferencia).toHaveBeenCalledWith("u1", {
      data: "2026-07-12",
      de: "AB Gold (C)",
      para: "Conta Principal",
      valor: 30000,
      descricao: "Transferência de ActivoBank",
    });
    // Nada em receitas nem em despesas correntes.
    expect(update).not.toHaveBeenCalled();
    expect(n).toBe(1);
  });

  test("a mesma importação reparte os três destinos", async () => {
    const n = await confirmarImportacao("u1", [
      linha({ id: 1 }),
      linha({
        id: 2,
        descricao: "POWERDOT",
        valor: -1050,
        destino: "carga",
        localCarga: "Powerdot",
        kwhCarga: "10",
      }),
      linha({
        id: 3,
        descricao: "Salário",
        valor: 200000,
        destino: "lancamento",
        classificacao: {
          tipo: "receita",
          categoria: "Salário",
          incerto: false,
          confianca: "high",
          motivo: "regra",
        },
        categoriaEscolhida: "Salário",
        // Quem decide o lado é esta escolha, não a classificação.
        tipoEscolhido: "receita",
      }),
    ]);

    expect(criarTransferencia).toHaveBeenCalledTimes(1);
    expect(criarCarga).toHaveBeenCalledTimes(1);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(gravado)).toHaveLength(1);
    expect(Object.keys(gravado)[0].startsWith("receitas/")).toBe(true);
    expect(n).toBe(3);
  });

  test("transferência incompleta faz falhar antes de gravar seja o que for", async () => {
    await expect(confirmarImportacao("u1", [linha({ contaOrigem: "" })])).rejects.toThrow(
      /Transferência/,
    );
    expect(update).not.toHaveBeenCalled();
    expect(criarTransferencia).not.toHaveBeenCalled();
  });
});

// A ponta a ponta que interessa: o que a importação grava é exatamente o que a
// fatura do cartão vai buscar. Sem isto, o destino novo podia gravar uma
// transferência bem formada que a fatura nunca somasse.
describe("a transferência importada chega à fatura do cartão", () => {
  test("entra no valor devido do ciclo, no cartão de origem", () => {
    const linha: LinhaAnalisada = {
      id: 0,
      data: "2026-06-12",
      descricao: "Transferência de ActivoBank",
      valor: 30000,
      classificacao: {
        tipo: "transferencia",
        categoria: "Transferência",
        incerto: true,
        confianca: "medium",
        motivo: "regra",
      },
      duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
      decisao: "revisao",
      acao: "import",
      categoriaEscolhida: "Transferência",
      tipoEscolhido: "despesa",
      destino: "transferencia_cartao",
      localCarga: "",
      kwhCarga: "",
      contaOrigem: "AB Gold (C)",
      contaDestino: "Conta Principal",
    };
    const transferencia = { ...dadosDaTransferencia(linha)!, id: "t1" };

    const dados = {
      despesasFixas: [],
      despesasFixasVeiculo: [],
      despesasCorrentes: [],
      parcelas: [],
      transferencias: [transferencia],
    };
    // O 2º argumento é o MÊS DA FATURA, não o ciclo: a fatura de julho é que
    // cobra os gastos de junho, e é ela que tem de trazer esta transferência.
    expect(calcularFaturaAutomatica("AB Gold (C)", "2026-07", dados)).toBe(30000);
    // Noutro cartão, ou noutra fatura, não aparece.
    expect(calcularFaturaAutomatica("Outro cartão", "2026-07", dados)).toBe(0);
    expect(calcularFaturaAutomatica("AB Gold (C)", "2026-08", dados)).toBe(0);
  });
});

describe("fonte da receita e origem da transferência", () => {
  const receita = (categoriaEscolhida: string): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-16",
    descricao: "Entrada pequena",
    valor: 1611,
    classificacao: {
      tipo: "receita",
      categoria: null,
      incerto: false,
      confianca: "low",
      motivo: "sem regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "nova",
    acao: "import",
    categoriaEscolhida,
    tipoEscolhido: "receita",
    destino: "lancamento",
    localCarga: "",
    kwhCarga: "",
    contaOrigem: "",
    contaDestino: "",
  });

  beforeEach(() => {
    vi.mocked(update).mockClear();
    vi.mocked(criarTransferencia).mockClear();
  });

  test("a fonte escolhida na revisão é a que fica gravada na receita", async () => {
    await confirmarImportacao("u1", [receita("TVDE")]);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, { fonte: string }>;
    const [caminho, valor] = Object.entries(gravado)[0];
    expect(caminho.startsWith("receitas/")).toBe(true);
    expect(valor.fonte).toBe("TVDE");
  });

  test("sem fonte escolhida a receita cai em Outros, como antes", async () => {
    await confirmarImportacao("u1", [receita("")]);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, { fonte: string }>;
    expect(Object.values(gravado)[0].fonte).toBe("Outros");
  });

  test("origem numa conta comum não entra em fatura nenhuma", () => {
    // Mesma linha do teste da fatura, mas vinda de uma conta em vez de cartão.
    const linha: LinhaAnalisada = {
      ...receita("Transferência"),
      data: "2026-06-16",
      valor: 1611,
      destino: "transferencia_cartao",
      contaOrigem: "Conta Poupança",
      contaDestino: "Conta Principal",
    };
    const transferencia = { ...dadosDaTransferencia(linha)!, id: "t2" };
    const dados = {
      despesasFixas: [],
      despesasFixasVeiculo: [],
      despesasCorrentes: [],
      parcelas: [],
      transferencias: [transferencia],
    };
    // A transferência existe e está bem formada...
    expect(transferencia.de).toBe("Conta Poupança");
    expect(transferencia.valor).toBe(1611);
    // ...e não aparece na fatura do cartão de crédito, porque não saiu dele.
    // (A tela Cartões só pede fatura para contas marcadas como "credit", por
    // isso "a fatura da Conta Poupança" não é pergunta que alguém faça.)
    expect(calcularFaturaAutomatica("AB Gold (C)", "2026-07", dados)).toBe(0);

    // Contraprova: a mesma linha vinda do cartão entra na fatura dele.
    const doCartao = {
      ...dadosDaTransferencia({ ...linha, contaOrigem: "AB Gold (C)" })!,
      id: "t3",
    };
    expect(
      calcularFaturaAutomatica("AB Gold (C)", "2026-07", { ...dados, transferencias: [doCartao] }),
    ).toBe(1611);
  });
});

describe("o lado escolhido à mão manda sobre o automático", () => {
  const estorno = (tipoEscolhido: "receita" | "despesa"): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-20",
    descricao: "Mercadona Amial",
    valor: 20,
    // O automático classificou como despesa (bateu em "Mercadona"), ainda que
    // marcando a contradição — o valor está a entrar.
    classificacao: {
      tipo: "despesa",
      categoria: "Mercado",
      incerto: true,
      confianca: "high",
      motivo: "regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "revisao",
    acao: "import",
    categoriaEscolhida: tipoEscolhido === "receita" ? "Outros" : "Mercado",
    tipoEscolhido,
    destino: "lancamento",
    localCarga: "",
    kwhCarga: "",
    contaOrigem: "",
    contaDestino: "",
  });

  beforeEach(() => vi.mocked(update).mockClear());

  test("virado para Receita, grava em receitas apesar da classificação dizer despesa", async () => {
    await confirmarImportacao("u1", [estorno("receita")]);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, { fonte?: string }>;
    const [caminho, valor] = Object.entries(gravado)[0];
    expect(caminho.startsWith("receitas/")).toBe(true);
    expect(valor.fonte).toBe("Outros");
  });

  test("deixado como Despesa, continua a gravar onde sempre gravou", async () => {
    await confirmarImportacao("u1", [estorno("despesa")]);
    const gravado = vi.mocked(update).mock.calls[0][1] as Record<string, { categoria?: string }>;
    const [caminho, valor] = Object.entries(gravado)[0];
    expect(caminho.startsWith("despesasCorrentes/")).toBe(true);
    expect(valor.categoria).toBe("Mercado");
  });
});

describe("transferência do lado de quem manda", () => {
  const saida = (mudancas: Partial<LinhaAnalisada> = {}): LinhaAnalisada => ({
    id: 0,
    data: "2026-07-18",
    descricao: "Transferência para a poupança",
    // Negativo: é a linha no extrato da conta que MANDA o dinheiro.
    valor: -25000,
    classificacao: {
      tipo: "transferencia",
      categoria: "Transferência",
      incerto: false,
      confianca: "medium",
      motivo: "regra",
    },
    duplicata: { status: "new", confianca: null, correspondencia: null, score: 0, motivos: [] },
    decisao: "revisao",
    acao: "import",
    categoriaEscolhida: "Transferência",
    tipoEscolhido: "despesa",
    destino: "transferencia_cartao",
    localCarga: "",
    kwhCarga: "",
    contaOrigem: "Conta Principal",
    contaDestino: "Conta Poupança",
    ...mudancas,
  });

  beforeEach(() => {
    vi.mocked(update).mockClear();
    vi.mocked(criarTransferencia).mockClear();
  });

  test("grava com valor positivo, no sentido escolhido — não é despesa", async () => {
    const n = await confirmarImportacao("u1", [saida()]);
    expect(criarTransferencia).toHaveBeenCalledWith("u1", {
      data: "2026-07-18",
      de: "Conta Principal",
      para: "Conta Poupança",
      // O sinal do extrato diz o lado, não o valor guardado: `Transferencia`
      // é sempre positiva, com a direção em `de`/`para`.
      valor: 25000,
      descricao: "Transferência para a poupança",
    });
    // Nada em despesasCorrentes: era aqui que este dinheiro inchava os gastos.
    expect(update).not.toHaveBeenCalled();
    expect(n).toBe(1);
  });

  test("a mesma validação da entrada vale para a saída", () => {
    expect(dadosDaTransferencia(saida({ contaOrigem: "" }))).toBeNull();
    expect(dadosDaTransferencia(saida({ contaDestino: "Conta Principal" }))).toBeNull();
  });
});

describe("transferência já registada aparece nos dois lados", () => {
  // O movimento do commit anterior: 250 € da conta principal para a poupança.
  const TRANSFERENCIA: Transferencia = {
    id: "t-1",
    data: "2026-07-18",
    de: "Conta Principal",
    para: "Conta Poupança",
    valor: 25000,
    descricao: "Transferência para a poupança",
  };
  const ctx = {
    parcelas: [],
    categoriasConfiguradas: [],
    existentes: [],
    locaisCarregamento: [],
    cargasHistorico: [],
  };
  const existentes = construirExistentes([], [], [], [], [TRANSFERENCIA], []);

  test("uma transferência vira duas entradas, uma por sentido", () => {
    expect(existentes).toEqual([
      { id: "t-1", data: "2026-07-18", valor: -25000, descricao: "Transferência para a poupança" },
      { id: "t-1", data: "2026-07-18", valor: 25000, descricao: "Transferência para a poupança" },
    ]);
  });

  test("o extrato de quem MANDOU reconhece o lado da saída", () => {
    const linha = { data: "2026-07-18", descricao: "Transferência para a poupança", valor: -25000 };
    const achado = verificarDuplicata(linha, existentes);
    expect(achado.status).not.toBe("new");
    expect(achado.correspondencia?.id).toBe("t-1");
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("o extrato de quem RECEBEU reconhece o lado da entrada", () => {
    // Era este o furo: o outro extrato do mesmo dinheiro entrava sem aviso.
    const linha = { data: "2026-07-18", descricao: "Transferência recebida", valor: 25000 };
    const achado = verificarDuplicata(linha, existentes);
    expect(achado.status).not.toBe("new");
    expect(achado.correspondencia?.id).toBe("t-1");
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("sem descrição própria, compara-se pelo caminho do dinheiro", () => {
    const semDescricao = construirExistentes(
      [],
      [],
      [],
      [],
      [{ ...TRANSFERENCIA, descricao: undefined }],
      [],
    );
    expect(semDescricao[0].descricao).toBe("Conta Principal → Conta Poupança");
  });

  test("transferência mesmo nova continua a entrar como nova", () => {
    // Valor diferente...
    expect(
      verificarDuplicata(
        { data: "2026-07-18", descricao: "Transferência para a poupança", valor: -10000 },
        existentes,
      ).status,
    ).toBe("new");
    // ...e data fora da janela.
    expect(
      verificarDuplicata(
        { data: "2026-08-18", descricao: "Transferência para a poupança", valor: -25000 },
        existentes,
      ).status,
    ).toBe("new");
  });
});

describe("despesa fixa paga entra na busca por duplicata", () => {
  const FIXA: DespesaFixa = {
    id: "f-1",
    descricao: "Renda",
    valor: 65000,
    categoria: "Casa",
    diaVencimento: 8,
    pagoPorMes: { "2026-07": true, "2026-06": true, "2026-05": false },
  };
  const ctx = {
    parcelas: [],
    categoriasConfiguradas: [],
    existentes: [],
    locaisCarregamento: [],
    cargasHistorico: [],
  };
  const existentes = construirExistentes([], [], [], [], [], [FIXA]);

  test("uma entrada por mês PAGO, na data do vencimento", () => {
    expect(existentes).toEqual([
      { id: "f-1", data: "2026-07-08", valor: -65000, descricao: "Renda Casa" },
      { id: "f-1", data: "2026-06-08", valor: -65000, descricao: "Renda Casa" },
    ]);
  });

  test("o banco debitou 3 dias depois do vencimento — continua a ser a mesma", () => {
    const linha = { data: "2026-07-11", descricao: "TRF RENDA CASA", valor: -65000 };
    const achado = verificarDuplicata(linha, existentes);
    expect(achado.status).not.toBe("new");
    expect(achado.correspondencia?.id).toBe("f-1");
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("e 6 dias depois também — a janela da comparação já dava para isso", () => {
    const linha = { data: "2026-07-14", descricao: "TRF RENDA CASA", valor: -65000 };
    expect(verificarDuplicata(linha, existentes).status).not.toBe("new");
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("mês por pagar não entra — esse dinheiro ainda não saiu", () => {
    // Maio está em `pagoPorMes` como false: uma linha de maio é mesmo nova.
    const linha = { data: "2026-05-08", descricao: "TRF RENDA CASA", valor: -65000 };
    expect(verificarDuplicata(linha, existentes).status).toBe("new");
  });

  test("fixa sem dia de vencimento não gera entrada nenhuma", () => {
    const semDia: DespesaFixa = { ...FIXA, diaVencimento: undefined };
    expect(construirExistentes([], [], [], [], [], [semDia])).toEqual([]);
  });

  test("vencimento a 31 num mês curto fica no último dia, não escorrega", () => {
    const dia31: DespesaFixa = {
      ...FIXA,
      diaVencimento: 31,
      pagoPorMes: { "2026-02": true },
    };
    expect(construirExistentes([], [], [], [], [], [dia31])[0].data).toBe("2026-02-28");
  });
});
