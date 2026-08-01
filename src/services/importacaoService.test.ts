import { describe, expect, test } from "vitest";
import { construirExistentes } from "./importacaoService";
import { analisarLinha, verificarDuplicata } from "../utils/importacao";
import type { CargaEletrica, DespesaCorrente, DespesaVeiculo, Receita } from "../types";

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

const SEM_VEICULO: [CargaEletrica[], DespesaVeiculo[]] = [[], []];

describe("construirExistentes", () => {
  test("despesa com origem parc/fat entra na comparação", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA, PAGAMENTO_FATURA], ...SEM_VEICULO);
    expect(existentes.map((e) => e.id)).toEqual(["d-parc", "d-fat"]);
    // Despesa: valor negativo, para bater com a saída do extrato.
    expect(existentes[0].valor).toBe(-9990);
  });

  test("carga elétrica e despesa do veículo entram, como despesa", () => {
    const existentes = construirExistentes([], [], [CARGA], [DESPESA_VEICULO]);
    expect(existentes).toEqual([
      { id: "v-c1", data: "2026-07-08", valor: -1050, descricao: "Powerdot" },
      { id: "v-d1", data: "2026-07-20", valor: -8500, descricao: "Norauto Manutenção" },
    ]);
  });

  test("despesa do veículo sem nota fica só com a categoria", () => {
    const semNota: DespesaVeiculo = { ...DESPESA_VEICULO, nota: undefined };
    expect(construirExistentes([], [], [], [semNota])[0].descricao).toBe("Manutenção");
  });

  test("receita continua com o valor positivo", () => {
    const receita: Receita = {
      id: "r1",
      descricao: "Julho",
      valor: 200000,
      data: "2026-07-05",
      fonte: "Salário",
    };
    expect(construirExistentes([receita], [], ...SEM_VEICULO)[0]).toEqual({
      id: "r1",
      data: "2026-07-05",
      valor: 200000,
      descricao: "Salário Julho",
    });
  });
});

describe("dedup com os lançamentos que faltavam", () => {
  const ctx = { parcelas: [], categoriasConfiguradas: [], existentes: [] };

  test("pagamento da prestação no extrato deixa de passar como novo", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA], ...SEM_VEICULO);
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
    const existentes = construirExistentes([], [PAGAMENTO_FATURA], ...SEM_VEICULO);
    const linha = { data: "2026-07-15", descricao: "PAGAMENTO CARTAO CREDITO", valor: -45000 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("recarga já lançada na aba Veículo é apanhada — e pelo nome do posto", () => {
    const existentes = construirExistentes([], [], [CARGA], []);
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
    const existentes = construirExistentes([], [], [CARGA], []);
    const linha = { data: "2026-07-08", descricao: "Powerdot", valor: -1050 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).decisao).toBe("duplicata_provavel");
  });

  test("despesa do veículo já lançada é apanhada pela nota", () => {
    const existentes = construirExistentes([], [], [], [DESPESA_VEICULO]);
    const linha = { data: "2026-07-20", descricao: "NORAUTO MATOSINHOS", valor: -8500 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("despesa nova de verdade continua a entrar como nova", () => {
    const existentes = construirExistentes(
      [],
      [DESPESA_COMUM, PARCELA_PAGA, PAGAMENTO_FATURA],
      [CARGA],
      [DESPESA_VEICULO],
    );
    const linha = { data: "2026-07-22", descricao: "Mercadona", valor: -3200 };
    const analisada = analisarLinha(linha, 0, { ...ctx, existentes });
    expect(analisada.duplicata.status).toBe("new");
    expect(analisada.acao).toBe("import");
  });

  test("mesmo valor mas fora da janela de datas não é duplicata", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA], ...SEM_VEICULO);
    const linha = { data: "2026-08-10", descricao: "PAG.PRESTACAO N. 010", valor: -9990 };
    expect(verificarDuplicata(linha, existentes).status).toBe("new");
  });
});
