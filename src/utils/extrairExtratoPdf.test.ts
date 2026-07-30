import { describe, expect, test } from "vitest";
import { extrairWise, type ItemTexto } from "./extrairExtratoPdf";

// Coordenadas iguais às do extrato real: a data fica 11-13 pontos ABAIXO da
// linha da transação, a descrição em x=42, Entrada em x≈393, Saída em x≈458 e
// a coluna Valor (saldo, a ignorar) em x≈530.
function item(str: string, x: number, y: number): ItemTexto {
  return { str, transform: [0, 0, 0, 0, x, y] };
}

function transacao(opcoes: {
  y: number;
  descricao: string;
  entrada?: string;
  saida?: string;
  saldo: string;
  data: string;
}): ItemTexto[] {
  const { y, descricao, entrada, saida, saldo, data } = opcoes;
  return [
    item(descricao, 42, y + 13.2),
    ...(entrada ? [item(entrada, 393.3, y + 11.1)] : []),
    ...(saida ? [item(saida, 458, y + 11.1)] : []),
    item(saldo, 530, y + 11.1),
    item(data, 42, y),
    item("Transação: TRANSFER-123", 116.5, y),
  ];
}

describe("extrairWise", () => {
  test("saída vira despesa e entrada vira receita, com a data por extenso", () => {
    const linhas = extrairWise([
      [
        ...transacao({
          y: 402,
          descricao: "Enviou dinheiro para Fulano",
          saida: "-107,37",
          saldo: "0,00",
          data: "25 de abril de 2026",
        }),
        ...transacao({
          y: 365,
          descricao: "652,73 BRL convertidos para 107,37 EUR",
          entrada: "107,37",
          saldo: "107,37",
          data: "25 de abril de 2026",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      { data: "2026-04-25", descricao: "Enviou dinheiro para Fulano", valor: -10737 },
      { data: "2026-04-25", descricao: "652,73 BRL convertidos para 107,37 EUR", valor: 10737 },
    ]);
  });

  test("a coluna Valor (saldo) nunca vira o valor da linha", () => {
    // Saldo bem diferente do movimento: se fosse lido por engano, apareceria.
    const [linha] = extrairWise([
      [
        ...transacao({
          y: 300,
          descricao: "Enviou dinheiro",
          saida: "-20,00",
          saldo: "9.999,99",
          data: "3 de março de 2026",
        }),
      ],
    ]);
    expect(linha).toEqual({ data: "2026-03-03", descricao: "Enviou dinheiro", valor: -2000 });
  });

  test("todos os meses do ano são reconhecidos", () => {
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const linhas = extrairWise(
      meses.map((mes) => [
        ...transacao({
          y: 400,
          descricao: "Movimento",
          entrada: "10,00",
          saldo: "10,00",
          data: `1 de ${mes} de 2026`,
        }),
      ]),
    );
    expect(linhas.map((l) => l.data)).toEqual(
      meses.map((_, i) => `2026-${String(i + 1).padStart(2, "0")}-01`),
    );
  });

  test("linha sem Entrada nem Saída é descartada (só tem saldo)", () => {
    const itens = [
      item("Linha sem movimento", 42, 413.2),
      item("0,00", 530, 411.1),
      item("1 de maio de 2026", 42, 400),
    ];
    expect(extrairWise([itens])).toEqual([]);
  });

  test("data por extenso de outro mês não confunde a linha de cima", () => {
    // Duas transações seguidas: cada data só pode apanhar a sua própria linha.
    const linhas = extrairWise([
      [
        ...transacao({
          y: 402,
          descricao: "Primeira",
          saida: "-10,00",
          saldo: "0,00",
          data: "25 de abril de 2026",
        }),
        ...transacao({
          y: 365,
          descricao: "Segunda",
          entrada: "30,00",
          saldo: "30,00",
          data: "24 de abril de 2026",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      { data: "2026-04-25", descricao: "Primeira", valor: -1000 },
      { data: "2026-04-24", descricao: "Segunda", valor: 3000 },
    ]);
  });
});
