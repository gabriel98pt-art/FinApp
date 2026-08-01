import { describe, expect, test } from "vitest";
import { construirExistentes } from "./importacaoService";
import { analisarLinha, verificarDuplicata } from "../utils/importacao";
import type { DespesaCorrente, Receita } from "../types";

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

describe("construirExistentes", () => {
  test("despesa com origem parc/fat entra na comparação", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA, PAGAMENTO_FATURA]);
    expect(existentes.map((e) => e.id)).toEqual(["d-parc", "d-fat"]);
    // Despesa: valor negativo, para bater com a saída do extrato.
    expect(existentes[0].valor).toBe(-9990);
  });

  test("receita continua com o valor positivo", () => {
    const receita: Receita = {
      id: "r1",
      descricao: "Julho",
      valor: 200000,
      data: "2026-07-05",
      fonte: "Salário",
    };
    expect(construirExistentes([receita], [])[0]).toEqual({
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
    const existentes = construirExistentes([], [PARCELA_PAGA]);
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
    const existentes = construirExistentes([], [PAGAMENTO_FATURA]);
    const linha = { data: "2026-07-15", descricao: "PAGAMENTO CARTAO CREDITO", valor: -45000 };
    expect(analisarLinha(linha, 0, { ...ctx, existentes }).acao).toBe("skip");
  });

  test("despesa nova de verdade continua a entrar como nova", () => {
    const existentes = construirExistentes([], [DESPESA_COMUM, PARCELA_PAGA, PAGAMENTO_FATURA]);
    const linha = { data: "2026-07-22", descricao: "Mercadona", valor: -3200 };
    const analisada = analisarLinha(linha, 0, { ...ctx, existentes });
    expect(analisada.duplicata.status).toBe("new");
    expect(analisada.acao).toBe("import");
  });

  test("mesmo valor mas fora da janela de datas não é duplicata", () => {
    const existentes = construirExistentes([], [PARCELA_PAGA]);
    const linha = { data: "2026-08-10", descricao: "PAG.PRESTACAO N. 010", valor: -9990 };
    expect(verificarDuplicata(linha, existentes).status).toBe("new");
  });
});
