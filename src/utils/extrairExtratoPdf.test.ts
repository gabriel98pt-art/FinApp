import { describe, expect, test } from "vitest";
import {
  extrairActivoBank,
  extrairActivoBankCartao,
  extrairRevolut,
  extrairWise,
  type ItemTexto,
} from "./extrairExtratoPdf";

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

// No ActivoBank cada linha tem os números a um Y e o texto ~0,8 pontos acima.
// Colunas: data lanç. x=56.7, data valor x=87.3, descrição x≥114, montante
// x≥350, saldo x≥510.
function movimento(opcoes: {
  y: number;
  dataLanc: string;
  descricao: string;
  montante: string;
  saldo: string;
}): ItemTexto[] {
  const { y, dataLanc, descricao, montante, saldo } = opcoes;
  return [
    item(dataLanc, 56.7, y),
    item(dataLanc, 87.3, y),
    item(montante, 356.3, y),
    item(saldo, 528, y),
    item(descricao, 114.5, y + 0.8),
  ];
}

describe("extrairActivoBank", () => {
  // O arredondamento antigo (Math.round(y / 6) * 6) partia a linha em duas
  // sempre que o par números/texto calhava em cima de uma fronteira: 386,6 ia
  // para 384 e 387,4 para 390. A linha ficava sem descrição e era descartada,
  // e o valor dela colava-se ao movimento seguinte.
  test("linha cujo texto e números caem em lados opostos de um múltiplo de 6", () => {
    const linhas = extrairActivoBank([
      [
        item("SALDO INICIAL", 46, 500),
        item("190.14", 528, 500),
        // 396,0 / 396,8 — mesmo balde no esquema antigo, sempre funcionou
        ...movimento({
          y: 396,
          dataLanc: "3.02",
          descricao: "TRF. P/O ALGUEM",
          montante: "340.00",
          saldo: "530.14",
        }),
        // 386,6 / 387,4 — baldes diferentes no esquema antigo: era esta que sumia
        ...movimento({
          y: 386.6,
          dataLanc: "3.02",
          descricao: "TRF P/ OUTREM LDA",
          montante: "275.00",
          saldo: "255.14",
        }),
        ...movimento({
          y: 377.2,
          dataLanc: "3.03",
          descricao: "CRÉDITO CASHBACK",
          montante: "0.48",
          saldo: "255.62",
        }),
      ],
    ]);
    expect(linhas.map((l) => l.descricao)).toEqual([
      "TRF. P/O ALGUEM",
      "TRF P/ OUTREM LDA",
      "CRÉDITO CASHBACK",
    ]);
    // E o cashback fica com o SEU valor, não com o do vizinho colado.
    expect(linhas.map((l) => l.valor)).toEqual([34000, -27500, 48]);
  });

  test("a soma dos movimentos fecha com a variação do saldo", () => {
    const linhas = extrairActivoBank([
      [
        item("SALDO INICIAL", 46, 500),
        item("100.00", 528, 500),
        ...movimento({
          y: 386.6,
          dataLanc: "3.02",
          descricao: "COMPRA A",
          montante: "25.00",
          saldo: "75.00",
        }),
        ...movimento({
          y: 377.2,
          dataLanc: "3.03",
          descricao: "COMPRA B",
          montante: "10.00",
          saldo: "65.00",
        }),
      ],
    ]);
    expect(linhas.reduce((s, l) => s + l.valor, 0)).toBe(6500 - 10000);
  });
});

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

// ---------------------------------------------------------------- Revolut

/* Coordenadas iguais às do extrato real: as colunas começam em Data 39.7,
   Descrição 124.5, Categoria 257.2, Dinheiro a entrar/sair 342, Saldo 384.4,
   Imposto retido 426.9, Outros impostos 469.3, Comissões 513 (com os valores
   a 534). O cabeçalho ocupa três linhas de texto separadas por 6,2 pontos,
   porque os rótulos compridos quebram; as transações ficam a 18,7 e a linha
   de continuação da descrição a 12,4 da sua. */
const COL = {
  data: 39.7,
  descricao: 124.5,
  categoria: 257.2,
  valor: 342,
  saldo: 384.4,
  imposto: 426.9,
  outros: 469.3,
  comissoes: 534,
};

function cabecalhoRevolut(y: number, col: typeof COL = COL): ItemTexto[] {
  return [
    item("Dinheiro a", col.valor, y + 6.2),
    item("Imposto", col.imposto, y + 6.2),
    item("Outros", col.outros, y + 6.2),
    item("Data", col.data, y),
    item("Descrição", col.descricao, y),
    item("Categoria", col.categoria, y),
    item("Saldo", col.saldo, y),
    item("Comissões", col.comissoes - 21, y),
    item("entrar/sair", col.valor, y - 6.2),
    item("retido", col.imposto, y - 6.2),
    item("impostos", col.outros, y - 6.2),
  ];
}

function movimentoRevolut(opcoes: {
  y: number;
  data: string;
  descricao: string;
  categoria?: string;
  valor: string;
  saldo: string;
  col?: typeof COL;
}): ItemTexto[] {
  const { y, data, descricao, categoria = "Comerciante", valor, saldo, col = COL } = opcoes;
  return [
    item(data, col.data, y),
    item(descricao, col.descricao, y),
    item(categoria, col.categoria, y),
    item(valor, col.valor, y),
    item(saldo, col.saldo, y),
    item("0,00€", col.imposto, y),
    item("0,00€", col.outros, y),
    item("0,00€", col.comissoes, y),
  ];
}

describe("extrairRevolut", () => {
  // O caminho genérico devolvia "Continente Comerciante 175,06€ 0,00€ 0,00€
  // 0,00€" como descrição: espera um só número no fim da linha e aqui há
  // quatro (saldo + dois impostos + comissões).
  test("descrição fica só com a coluna Descrição, sem saldo/impostos/comissões", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Continente",
          valor: "-12,40€",
          saldo: "175,06€",
        }),
      ],
    ]);
    expect(linhas).toEqual([{ data: "2026-07-01", descricao: "Continente", valor: -1240 }]);
  });

  test("descrição partida em duas linhas junta-se à transação de cima", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Transferência para LUIS",
          categoria: "Outros",
          valor: "-20,00€",
          saldo: "127,79€",
        }),
        // Continuação: só texto na coluna da descrição, sem data nem valor.
        item("HENRIQUE PIRES DE OLIVEIRA", COL.descricao, 649.7),
        ...movimentoRevolut({
          y: 631,
          data: "02/07/2026",
          descricao: "Auchan",
          valor: "-0,29€",
          saldo: "127,50€",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      {
        data: "2026-07-01",
        descricao: "Transferência para LUIS HENRIQUE PIRES DE OLIVEIRA",
        valor: -2000,
      },
      { data: "2026-07-02", descricao: "Auchan", valor: -29 },
    ]);
  });

  test('linha "Total" no fim da tabela não é movimento', () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Continente",
          valor: "-12,40€",
          saldo: "175,06€",
        }),
        item("Total", COL.data, 643.4),
        item("0,84€", COL.valor, 643.4),
        item("15,99€", COL.comissoes, 643.4),
      ],
    ]);
    expect(linhas).toEqual([{ data: "2026-07-01", descricao: "Continente", valor: -1240 }]);
  });

  test("uma tabela por conta: a segunda conta também é lida", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Primeira conta",
          valor: "10,00€",
          saldo: "10,00€",
        }),
      ],
      [
        item("Conta Poupança (EUR)", 39.7, 720),
        item("Extrato de operações", 39.7, 710),
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "02/07/2026",
          descricao: "Segunda conta",
          valor: "-5,00€",
          saldo: "5,00€",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      { data: "2026-07-01", descricao: "Primeira conta", valor: 1000 },
      { data: "2026-07-02", descricao: "Segunda conta", valor: -500 },
    ]);
  });

  test("descrição não continua de uma conta para a seguinte", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Última da conta",
          valor: "10,00€",
          saldo: "10,00€",
        }),
      ],
      [
        item("Conta Poupança (EUR)", 39.7, 720),
        item("Extrato de operações", 39.7, 710),
        ...cabecalhoRevolut(693.4),
        // Texto solto no topo da tabela nova: não pertence à conta anterior.
        item("SOBRA DE OUTRA CONTA", COL.descricao, 662.1),
      ],
    ]);
    expect(linhas).toEqual([{ data: "2026-07-01", descricao: "Última da conta", valor: 1000 }]);
  });

  test("conta noutra moeda fica de fora — o app lança tudo em euros", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "03/07/2026",
          descricao: "Compra em dólares",
          valor: "-12,00$",
          saldo: "0,00$",
        }),
      ],
    ]);
    expect(linhas).toEqual([]);
  });

  test("colunas noutro sítio: as fronteiras vêm do cabeçalho, não de X fixos", () => {
    const deslocado = {
      data: 50,
      descricao: 150,
      categoria: 280,
      valor: 360,
      saldo: 400,
      imposto: 440,
      outros: 480,
      comissoes: 545,
    };
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4, deslocado),
        ...movimentoRevolut({
          y: 662.1,
          data: "04/07/2026",
          descricao: "Mercadona",
          valor: "-3,20€",
          saldo: "70,32€",
          col: deslocado,
        }),
      ],
    ]);
    expect(linhas).toEqual([{ data: "2026-07-04", descricao: "Mercadona", valor: -320 }]);
  });

  test("página de resumo, sem tabela de operações, não devolve nada", () => {
    const linhas = extrairRevolut([
      [
        item("Contas-correntes Resumos", 39.7, 700),
        item("Saldo disponível inicial", 301.4, 660),
        item("187,46€", 535.5, 660),
        item("Saldo disponível final", 301.4, 645),
        item("188,30€", 535.5, 645),
      ],
    ]);
    expect(linhas).toEqual([]);
  });

  test("continuação de um movimento descartado não cola no movimento anterior", () => {
    const linhas = extrairRevolut([
      [
        ...cabecalhoRevolut(693.4),
        ...movimentoRevolut({
          y: 662.1,
          data: "01/07/2026",
          descricao: "Continente",
          valor: "-12,40€",
          saldo: "175,06€",
        }),
        // Movimento noutra moeda: sai fora, e a continuação dele também.
        ...movimentoRevolut({
          y: 643.4,
          data: "02/07/2026",
          descricao: "Transferência para JOÃO",
          categoria: "Outros",
          valor: "-12,00$",
          saldo: "0,00$",
        }),
        item("PEDRO DA SILVA", COL.descricao, 631),
      ],
    ]);
    expect(linhas).toEqual([{ data: "2026-07-01", descricao: "Continente", valor: -1240 }]);
  });
});

// ------------------------------------------- ActivoBank, fatura de cartão

/* Coordenadas do extrato real: as duas datas vêm no MESMO item, à esquerda
   (x=56.7); a descrição em x=163; a marca da rede ("VIS") numa linha própria
   logo abaixo; e os números alinhados à direita — débito perto de 464-469,
   crédito perto de 538-548, com os rótulos em 457.2 e 535.5. */
function cabecalhoCartao(y: number): ItemTexto[] {
  return [
    item("Data", 56.7, y + 9),
    item("Data", 105.9, y + 9),
    item("Movimento", 56.7, y),
    item("Valor", 105.9, y),
    item("Descritivo", 160.3, y),
    item("Rede", 310.8, y),
    item("Débito", 457.2, y),
    item("Crédito", 535.5, y),
  ];
}

function movimentoCartao(opcoes: {
  y: number;
  datas: string;
  descricao: string;
  debito?: string;
  credito?: string;
  rede?: string;
}): ItemTexto[] {
  const { y, datas, descricao, debito, credito, rede } = opcoes;
  return [
    item(datas, 56.7, y),
    item(descricao, 163, y),
    ...(debito ? [item(debito, 464, y)] : []),
    ...(credito ? [item(credito, 538.5, y)] : []),
    // A rede assenta numa linha própria, por baixo — nunca deve entrar na
    // descrição nem virar movimento nenhum.
    ...(rede ? [item(rede, 319.1, y - 9)] : []),
  ];
}

describe("extrairActivoBankCartao", () => {
  test("débito fica negativo e crédito positivo, com a data VALOR", () => {
    const linhas = extrairActivoBankCartao([
      [
        item("DETALHE DOS MOVIMENTOS", 56.7, 700),
        ...cabecalhoCartao(680),
        ...movimentoCartao({
          y: 660,
          datas: "2026/06/30 2026/07/01",
          descricao: "COMPRA 6897 CONTINENTE BOM DIA PORTO",
          debito: "15.78",
          rede: "VIS",
        }),
        ...movimentoCartao({
          y: 640,
          datas: "2026/07/01 2026/07/15",
          descricao: "PAGAMENTO CARTAO DE CREDITO",
          credito: "220.41",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      // A data guardada é a segunda: é quando o valor mexeu na fatura.
      { data: "2026-07-01", descricao: "COMPRA 6897 CONTINENTE BOM DIA PORTO", valor: -1578 },
      { data: "2026-07-15", descricao: "PAGAMENTO CARTAO DE CREDITO", valor: 22041 },
    ]);
  });

  test("o plano de prestações não entra — é a mesma compra outra vez", () => {
    const linhas = extrairActivoBankCartao([
      [
        // O plano vem ANTES da tabela de movimentos na página real.
        item("DETALHE DE TRANSAÇÕES COM PAGAMENTO FRACIONADO", 56.7, 760),
        item("Data", 56.7, 740),
        item("Capital em", 172.7, 740),
        item("Mensalidade", 513.3, 740),
        item("2026/09/30", 56.7, 720),
        item("COMPRA 6897 CLINICA LN VILA NOVA DE GAIA", 111.2, 720),
        item("54.60", 544.3, 710),
        item("DETALHE DOS MOVIMENTOS", 56.7, 690),
        ...cabecalhoCartao(670),
        ...movimentoCartao({
          y: 650,
          datas: "2026/07/03 2026/07/06",
          descricao: "COMPRA 6897 MCH Portugal",
          debito: "12.22",
          rede: "VIS",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      { data: "2026-07-06", descricao: "COMPRA 6897 MCH Portugal", valor: -1222 },
    ]);
  });

  test("plano de prestações DEPOIS dos movimentos também fica de fora", () => {
    const linhas = extrairActivoBankCartao([
      [
        item("DETALHE DOS MOVIMENTOS", 56.7, 700),
        ...cabecalhoCartao(680),
        ...movimentoCartao({
          y: 660,
          datas: "2026/07/03 2026/07/06",
          descricao: "COMPRA 6897 MCH Portugal",
          debito: "12.22",
        }),
        item("DETALHE DE TRANSAÇÕES COM PAGAMENTO FRACIONADO", 56.7, 640),
        // Linha do plano com a forma de um movimento: duas datas e um número.
        item("2026/09/30 2026/09/30", 56.7, 620),
        item("COMPRA 6897 CLINICA LN VILA NOVA DE GAIA", 163, 620),
        item("54.60", 464, 620),
      ],
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].descricao).toBe("COMPRA 6897 MCH Portugal");
  });

  test('"FRACIONADO" na descrição de um movimento não desliga a leitura', () => {
    // O juro do plano é um movimento de verdade, e vem escrito abreviado.
    const linhas = extrairActivoBankCartao([
      [
        item("DETALHE DOS MOVIMENTOS", 56.7, 700),
        ...cabecalhoCartao(680),
        ...movimentoCartao({
          y: 660,
          datas: "2026/07/31 2026/07/31",
          descricao: "JUROS PAG FRACIONADO",
          debito: "0.94",
        }),
        ...movimentoCartao({
          y: 640,
          datas: "2026/07/31 2026/07/31",
          descricao: "COMPRA 6897 Fracionada x3",
          debito: "10.00",
        }),
      ],
    ]);
    expect(linhas.map((l) => l.descricao)).toEqual([
      "JUROS PAG FRACIONADO",
      "COMPRA 6897 Fracionada x3",
    ]);
  });

  test("cabeçalho repetido noutra página continua a valer", () => {
    const pagina = (y: number, datas: string, descricao: string, debito: string) => [
      item("DETALHE DOS MOVIMENTOS", 56.7, y + 40),
      ...cabecalhoCartao(y + 20),
      ...movimentoCartao({ y, datas, descricao, debito, rede: "VIS" }),
    ];
    const linhas = extrairActivoBankCartao([
      pagina(660, "2026/07/03 2026/07/06", "Primeira página", "12.22"),
      pagina(660, "2026/07/16 2026/07/17", "Segunda página", "4.37"),
    ]);
    expect(linhas).toEqual([
      { data: "2026-07-06", descricao: "Primeira página", valor: -1222 },
      { data: "2026-07-17", descricao: "Segunda página", valor: -437 },
    ]);
  });

  test("a marca da rede não entra na descrição nem vira movimento", () => {
    const linhas = extrairActivoBankCartao([
      [
        item("DETALHE DOS MOVIMENTOS", 56.7, 700),
        ...cabecalhoCartao(680),
        ...movimentoCartao({
          y: 660,
          datas: "2026/07/28 2026/07/28",
          descricao: "COMPRA 6897 MBWAY - CINEMAS",
          debito: "81.00",
          rede: "MB",
        }),
      ],
    ]);
    expect(linhas).toEqual([
      { data: "2026-07-28", descricao: "COMPRA 6897 MBWAY - CINEMAS", valor: -8100 },
    ]);
  });

  test("sem cabeçalho de movimentos não se lê nada", () => {
    // Página de resumo: tem datas e números, mas não é a tabela.
    const linhas = extrairActivoBankCartao([
      [
        item("RESUMO DE MOVIMENTOS", 56.7, 700),
        item("2026/07/01 2026/07/31", 56.7, 680),
        item("Débitos", 163, 680),
        item("808.54", 464, 680),
      ],
    ]);
    expect(linhas).toEqual([]);
  });
});
