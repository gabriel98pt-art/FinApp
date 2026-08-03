// Extração de extrato bancário em PDF, portada do financas.html
// (_loadPdfJs ~7315, _impParsePDF ~7636, _impActivoBankFromItems ~7681).
// Devolve `LinhaExtrato[]`, a mesma coisa que `parseExtratoCsv` — daí em
// diante o fluxo de importação (classificação, dedup, revisão) é o mesmo.
//
// Quatro caminhos — os dois do original, mais a Wise e o Revolut:
//  0. ActivoBank, FATURA DE CARTÃO: outra tabela e outro documento — testado
//     primeiro, porque o nome do banco aparece nos dois. Ver
//     `extrairActivoBankCartao`.
//  1. ActivoBank conta à ordem, reconhecido pelo cabeçalho: extração ciente das
//     colunas, usando a posição X de cada item do PDF. O valor de cada linha vem da
//     DIFERENÇA entre o saldo dela e o da linha anterior — mais confiável do
//     que ler a coluna de débito/crédito, que vem com espaçamento errático.
//  2. Wise: duas linhas de texto por transação (descrição+valores em cima,
//     data por extenso em baixo) — ver `extrairWise`.
//  3. Revolut: tabela de oito colunas, com as fronteiras lidas do próprio
//     cabeçalho — ver `extrairRevolut`.
//  4. Qualquer outro banco: reconstrói as linhas de texto agrupando os itens
//     por coordenada Y (ordenados por X dentro da linha) e entrega esse texto
//     ao parser de texto livre que já existe.

import type { LinhaExtrato } from "../types";
import { parseExtratoTextoLivre } from "./importacaoParser";
import { parseMoney } from "./money";

/** Um item de texto do PDF.js reduzido ao que interessa aqui. */
export interface ItemTexto {
  str: string;
  /** Matriz de transformação; [4] é o X e [5] o Y do item na página. */
  transform: number[];
}

/** O leitor não chegou a carregar — o `import()` do PDF.js falhou. É outra
 *  coisa do que o ficheiro estar mal, e para o usuário a saída é outra
 *  (tentar de novo com melhor ligação), por isso vai distinguido. */
export class LeitorPdfIndisponivel extends Error {
  constructor(causa: unknown) {
    super("Não foi possível carregar o leitor de PDF", { cause: causa });
    this.name = "LeitorPdfIndisponivel";
  }
}

/** PDF.js é pesado e só serve para importar extrato em PDF: entra por
 *  `import()` dinâmico, que o Vite fatia num chunk à parte — quem nunca
 *  importa um PDF nunca o descarrega. O worker vem do próprio pacote (`?url`),
 *  não de um CDN como no app antigo.
 *
 *  São ~430 kB pedidos à rede no momento em que se escolhe o ficheiro: numa
 *  ligação fraca este pedido falha sozinho, sem o PDF ter nada de errado.
 *
 *  Build normal e não o `legacy/`: o que partia no Safari era uma API que
 *  falta ao WebKit, não sintaxe moderna, e o legacy traz exatamente o mesmo
 *  código nesse ponto — só pesaria mais 55 kB. Ver `extrairExtratoPdf`. */
async function carregarPdfJs() {
  try {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  } catch (erro) {
    throw new LeitorPdfIndisponivel(erro);
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Números do ActivoBank vêm em formatos mistos ("1.234,56", "1234.56",
 *  "1.234.56"). Portado tal como está (_impActivoBankAmt). Devolve euros. */
function valorActivoBank(bruto: string): number {
  const s = String(bruto ?? "")
    .trim()
    .replace(/[€$£\s]/g, "");
  if (/,\d{2}$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (/^\d+\.\d{2}$/.test(s)) return parseFloat(s);
  if ((s.match(/\./g) ?? []).length > 1) {
    const ultimo = s.lastIndexOf(".");
    return parseFloat(`${s.slice(0, ultimo).replace(/\./g, "")}.${s.slice(ultimo + 1)}`);
  }
  return parseFloat(s);
}

const RE_ACTIVOBANK = /EXTRATO\s+COMBINADO|ActivoBank|DEPOSITO\s+A\s+ORDEM/i;

/* Fronteiras das colunas do ActivoBank, da análise de coordenadas do PDF:
     x < 45        → marca de água / margem (ignorar)
     45 ≤ x < 82   → DATA LANÇ. (M.DD)
     82 ≤ x < 350  → DATA VALOR + DESCRITIVO
     350 ≤ x < 510 → DÉBITO ou CRÉDITO
     x ≥ 510       → SALDO */
const X_IGNORAR = 45;
const X_LANC = 82;
const X_VALOR = 350;
const X_SALDO = 510;

const RE_DATA_LANC = /^(\d{1,2})\.(\d{2})$/;
const RE_IGNORAR_LINHA =
  /^(SALDO\s+INICIAL|A\s+TRANSPORTAR|TRANSPORTE\b|SALDO\s+FINAL|SALDO\s+DISPON|DATA\s+LANC|DATA\s+VALOR|DEBITO|CREDITO|SALDO\b|EXT\.|LANC\.|VALOR\s+DESCR|ULTRAPASSAGEM|TAXA\s+ANUAL)/i;

/** Agrupa itens na mesma linha visual, de cima para baixo. `tolerancia` é a
 *  distância vertical máxima ao topo da linha para um item ainda pertencer a
 *  ela.
 *
 *  Junta por PROXIMIDADE e não por arredondamento (`Math.round(y / passo)`,
 *  como era antes): no ActivoBank o texto da descrição assenta ~0,8 pontos
 *  acima dos números da mesma linha, e o arredondamento mandava os dois para
 *  baldes diferentes sempre que o par calhava em cima de uma fronteira —
 *  386,6 caía em 384 e 387,4 em 390. A linha ficava sem descrição e era
 *  descartada; num extrato real eram 13 dos 87 movimentos. */
function agruparPorLinha<T extends ItemTexto>(itens: T[], tolerancia: number): T[][] {
  const ordenados = [...itens].sort((a, b) => b.transform[5] - a.transform[5]);
  const linhas: T[][] = [];
  let atual: T[] = [];
  let topo = 0;
  for (const item of ordenados) {
    if (atual.length === 0) topo = item.transform[5];
    else if (topo - item.transform[5] > tolerancia) {
      linhas.push(atual);
      atual = [];
      topo = item.transform[5];
    }
    atual.push(item);
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

/** Extração coluna-a-coluna do ActivoBank (_impActivoBankFromItems). */
export function extrairActivoBank(paginas: ItemTexto[][]): LinhaExtrato[] {
  // Ano: vem do número do extrato no cabeçalho ("2026/003").
  let ano = new Date().getFullYear();
  const tudo = paginas.map((itens) => itens.map((i) => i.str).join(" ")).join(" ");
  const mAno = /\b(\d{4})\/0*\d{2,3}\b/.exec(tudo);
  if (mAno && +mAno[1] >= 2000 && +mAno[1] <= 2100) ano = +mAno[1];

  const linhasExtrato: LinhaExtrato[] = [];
  let saldoAnterior: number | null = null;

  // SALDO INICIAL: o valor está na coluna do saldo, na mesma altura do rótulo.
  for (const itens of paginas) {
    const idx = itens.findIndex((i) => /SALDO\s+INICIAL/i.test(i.str));
    if (idx < 0 || saldoAnterior !== null) continue;
    const y = itens[idx].transform[5];
    for (const item of itens) {
      if (item.transform[4] < X_SALDO || Math.abs(item.transform[5] - y) > 8) continue;
      const v = valorActivoBank(item.str.trim());
      if (!Number.isNaN(v) && v > 0) {
        saldoAnterior = v;
        break;
      }
    }
  }

  for (const itens of paginas) {
    const uteis = itens.filter((i) => i.str.trim() && i.transform[4] >= X_IGNORAR);

    // 3 pontos: bem acima do desalinhamento real dentro da linha (0,8) e bem
    // abaixo do espaçamento entre linhas (~9,4).
    for (const linha of agruparPorLinha(uteis, 3)) {
      const texto = linha.map((i) => i.str.trim()).join(" ");
      if (RE_IGNORAR_LINHA.test(texto.trim())) continue;

      // Sem data na coluna de lançamento não é linha de movimento.
      const itemData = linha.find(
        (i) => i.transform[4] < X_LANC && RE_DATA_LANC.test(i.str.trim()),
      );
      if (!itemData) continue;
      const mData = RE_DATA_LANC.exec(itemData.str.trim())!;
      const mes = +mData[1];
      const dia = +mData[2];
      if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;

      const descricao = linha
        .filter((i) => i.transform[4] >= X_LANC && i.transform[4] < X_VALOR)
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str.trim())
        .join(" ")
        // A coluna do descritivo começa com a DATA VALOR — não é descrição.
        .replace(/^\d{1,2}\.\d{2}\s*/, "")
        .trim();
      if (!descricao) continue;

      const naColunaSaldo = linha.filter((i) => i.transform[4] >= X_SALDO);
      const saldo = naColunaSaldo.length
        ? valorActivoBank(naColunaSaldo[naColunaSaldo.length - 1].str)
        : NaN;
      if (Number.isNaN(saldo)) continue;

      // O valor sai da diferença de saldos; só na primeira linha sem saldo
      // anterior é que se recorre à coluna de débito/crédito.
      let valor: number;
      if (saldoAnterior !== null) {
        valor = Math.round((saldo - saldoAnterior) * 100) / 100;
      } else {
        const naColunaValor = linha.filter(
          (i) => i.transform[4] >= X_VALOR && i.transform[4] < X_SALDO,
        );
        if (!naColunaValor.length) continue;
        valor = -valorActivoBank(naColunaValor[0].str);
      }
      saldoAnterior = saldo;
      if (!valor) continue; // saldo inalterado: não é movimento

      linhasExtrato.push({
        data: `${ano}-${pad2(mes)}-${pad2(dia)}`,
        descricao,
        valor: Math.round(valor * 100),
      });
    }
  }

  return linhasExtrato;
}

/* ActivoBank — FATURA DE CARTÃO ("EXTRATO VISA …"), que é um documento
   diferente do extrato da conta à ordem, apesar do mesmo banco no rodapé. Era
   por causa desse rodapé que caía no extrair da conta: o formato não batia,
   não saía linha nenhuma, e o usuário via "nenhuma linha reconhecida" sem
   perceber que era só outro tipo de documento.

   A tabela que interessa é a de "DETALHE DOS MOVIMENTOS":

     Data Movimento | Data Valor | Descritivo | Rede | Débito | Crédito

   A fatura traz ainda "DETALHE DE TRANSAÇÕES COM PAGAMENTO FRACIONADO", que
   é o plano de prestações — a MESMA compra que já está nos movimentos, aberta
   em mensalidades futuras. Importar isso contaria o gasto várias vezes. */
const RE_CARTAO_SECAO = /DETALHE\s+DOS\s+MOVIMENTOS/i;
const RE_CARTAO_TITULO = /EXTRATO\s+VISA|Cart[ãa]o\s+de\s+Cr[ée]dito/i;

/** Título da tabela do plano de prestações. Escrito por extenso de propósito:
 *  a descrição de um movimento verdadeiro pode conter "PAG FRACIONADO" (o juro
 *  do plano é um movimento real), e isso não pode desligar a leitura. */
const RE_CARTAO_FRACIONADO = /DETALHE\s+DE\s+TRANSA[ÇC][ÕO]ES\s+COM\s+PAGAMENTO\s+FRACIONADO/i;

/** aaaa/mm/dd — as duas datas da linha vêm no mesmo item de texto, separadas
 *  por um espaço ("2026/06/30 2026/07/01"). */
const RE_DATA_CARTAO = /(\d{4})[/-](\d{2})[/-](\d{2})/g;

/** Folga à esquerda de cada fronteira: os números são alinhados à DIREITA e
 *  começam antes do rótulo da coluna. */
const TOL_CARTAO = 3;

interface ColunasCartao {
  descritivo: number;
  /** A marca da rede ("VIS", "MB") — vem em linha própria, mas se algum dia
   *  vier na mesma, é aqui que se corta para não entrar na descrição. */
  rede: number | null;
  debito: number;
  credito: number;
}

/** Colunas lidas do cabeçalho da tabela, como no Revolut — e não de X fixos.
 *  "Data Movimento"/"Data Valor" partem-se em duas linhas de texto e não são
 *  precisos: as duas datas de cada movimento vêm juntas à esquerda da
 *  descrição, e a que interessa é sempre a segunda (a data valor). */
function colunasCartao(linha: ItemTexto[]): ColunasCartao | null {
  const xDe = (re: RegExp) => linha.find((i) => re.test(i.str.trim()))?.transform[4];
  const descritivo = xDe(/^Descritivo$/i);
  const debito = xDe(/^D[ée]bito$/i);
  const credito = xDe(/^Cr[ée]dito$/i);
  if (descritivo === undefined || debito === undefined || credito === undefined) return null;
  if (!(descritivo < debito && debito < credito)) return null;
  return { descritivo, rede: xDe(/^Rede$/i) ?? null, debito, credito };
}

/** Fatura de cartão do ActivoBank. Uma linha por movimento, com o valor OU na
 *  coluna Débito (compra: sai dinheiro, valor negativo) OU na Crédito
 *  (pagamento da fatura, cashback: valor positivo) — nunca nas duas.
 *
 *  Débito e crédito distinguem-se por qual das duas colunas está mais perto,
 *  e não pelo X exato: os números são alinhados à direita, cada um começa num
 *  sítio diferente conforme a largura, e o meio entre os dois rótulos separa-os
 *  sem ambiguidade. */
export function extrairActivoBankCartao(paginas: ItemTexto[][]): LinhaExtrato[] {
  const linhasExtrato: LinhaExtrato[] = [];
  let col: ColunasCartao | null = null;

  for (const itens of paginas) {
    for (const linha of agruparPorLinha(
      itens.filter((i) => i.str.trim()),
      3,
    )) {
      const texto = linha.map((i) => i.str.trim()).join(" ");

      // Daqui para baixo é o plano de prestações: parar de ler até aparecer o
      // cabeçalho da tabela de movimentos outra vez.
      if (RE_CARTAO_FRACIONADO.test(texto)) {
        col = null;
        continue;
      }
      const cabecalho = colunasCartao(linha);
      if (cabecalho) {
        col = cabecalho;
        continue;
      }
      if (!col) continue;

      // Tudo à esquerda da descrição: é aí que estão as duas datas.
      const antesDaDescricao = linha
        .filter((i) => i.transform[4] < col!.descritivo - TOL_CARTAO)
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str.trim())
        .join(" ");
      const datas = [...antesDaDescricao.matchAll(RE_DATA_CARTAO)];
      // Sem duas datas não é linha de movimento (é título, total, rodapé…).
      if (datas.length < 2) continue;
      const dataValor = datas[datas.length - 1];

      const limiteDescricao = col.rede ?? col.debito;
      const descricao = linha
        .filter(
          (i) =>
            i.transform[4] >= col!.descritivo - TOL_CARTAO &&
            i.transform[4] < limiteDescricao - TOL_CARTAO,
        )
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!descricao) continue;

      const naArea = linha
        .filter((i) => i.transform[4] >= col!.debito - 40)
        .sort((a, b) => a.transform[4] - b.transform[4]);
      const item = naArea.find((i) => /\d/.test(i.str) && !Number.isNaN(valorActivoBank(i.str)));
      if (!item) continue;
      const euros = valorActivoBank(item.str.trim());
      if (!Number.isFinite(euros) || euros === 0) continue;

      const ehCredito = item.transform[4] >= (col.debito + col.credito) / 2;
      linhasExtrato.push({
        data: `${dataValor[1]}-${dataValor[2]}-${dataValor[3]}`,
        descricao,
        valor: Math.round(Math.abs(euros) * 100) * (ehCredito ? 1 : -1),
      });
    }
  }

  return linhasExtrato;
}

const RE_WISE = /Wise Payments|Extrato em EUR/i;

const MESES_PT: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** "25 de abril de 2026" — a Wise não usa data numérica em lado nenhum. */
const RE_DATA_EXTENSO = /^(\d{1,2})\s+de\s+([a-zà-ú]+)\s+de\s+(\d{4})$/i;

/* Colunas da tabela da Wise (cabeçalho "Descrição / Entrada / Saída / Valor",
   que só aparece na primeira página — daí as fronteiras serem fixas). Os
   números são alinhados à direita, mas as três colunas ficam bem separadas:
   Entrada em x≈386-397, Saída em x≈456-467, Valor em x≈522-537. */
const X_WISE_DESCRICAO = 360;
const X_WISE_SAIDA = 430;
const X_WISE_SALDO = 500;

/** Distância vertical da linha da data até a linha da transação logo acima:
   os valores ficam a +11 e a descrição a +13, constantes no documento todo. */
const BANDA_WISE = 20;

/** Wise: cada transação ocupa DUAS linhas de texto — em cima a descrição com
 *  os valores à direita, e logo abaixo a data por extenso com o id da
 *  transação. Ancora-se na data (inconfundível) e lê-se a linha de cima.
 *
 *  A coluna "Valor" é DELIBERADAMENTE ignorada: não é o valor do movimento, é
 *  um saldo que zera a cada envio e reaparece na conversão seguinte. O valor
 *  do movimento está em "Entrada" (positivo) ou em "Saída" (que já vem com
 *  sinal negativo) — nunca nas duas ao mesmo tempo. */
export function extrairWise(paginas: ItemTexto[][]): LinhaExtrato[] {
  const linhasExtrato: LinhaExtrato[] = [];

  for (const itens of paginas) {
    const datas = itens
      .filter((i) => RE_DATA_EXTENSO.test(i.str.trim()))
      .sort((a, b) => b.transform[5] - a.transform[5]);

    for (const item of datas) {
      const m = RE_DATA_EXTENSO.exec(item.str.trim())!;
      const mes = MESES_PT[m[2].toLowerCase()];
      if (!mes) continue;

      const y = item.transform[5];
      const acima = itens.filter(
        (i) => i.str.trim() && i.transform[5] > y && i.transform[5] <= y + BANDA_WISE,
      );

      const descricao = acima
        .filter((i) => i.transform[4] < X_WISE_DESCRICAO)
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str.trim())
        .join(" ")
        .trim();
      if (!descricao) continue;

      const naEntrada = acima.find(
        (i) => i.transform[4] >= X_WISE_DESCRICAO && i.transform[4] < X_WISE_SAIDA,
      );
      const naSaida = acima.find(
        (i) => i.transform[4] >= X_WISE_SAIDA && i.transform[4] < X_WISE_SALDO,
      );
      const bruto = naEntrada ?? naSaida;
      if (!bruto) continue;

      const valor = parseMoney(bruto.str);
      if (valor === null || valor === 0) continue;

      linhasExtrato.push({
        data: `${m[3]}-${pad2(mes)}-${pad2(+m[1])}`,
        descricao,
        valor,
      });
    }
  }

  return linhasExtrato;
}

/* Revolut ("Extrato personalizado", Revolut Bank UAB). O documento tem uma
   parte de resumos por conta (EUR, USD, Cripto…) sem tabela de lançamentos, e
   só depois "Contas-correntes Extratos de operações", com uma tabela POR
   CONTA — cada uma com o seu cabeçalho, repetido no topo de cada página:

     Data | Descrição | Categoria | Dinheiro a entrar/sair | Saldo |
     Imposto retido | Outros impostos | Comissões

   O valor do movimento é só a coluna "Dinheiro a entrar/sair" (já vem com
   sinal). Saldo/impostos/comissões ficam de fora — foi por não os separar que
   o caminho genérico devolvia a descrição suja com quatro números colados. */
const RE_REVOLUT = /Revolut/i;
const RE_REVOLUT_TITULO = /Extrato\s+personalizado/i;

/** dd/mm/aaaa, o formato da coluna Data. */
const RE_DATA_REVOLUT = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Início de uma tabela nova: daqui para baixo é outra conta. */
const RE_TABELA_REVOLUT = /Extrato\s+de\s+opera/i;

/** Folga à esquerda da fronteira de cada coluna. Os valores desta tabela são
 *  alinhados à esquerda, exatamente no X do rótulo do cabeçalho; esta margem
 *  só cobre um número que comece um pouco antes. */
const TOL_COLUNA_REVOLUT = 2;

/** X onde cada coluna que interessa começa, lido do cabeçalho da tabela. */
interface ColunasRevolut {
  data: number;
  descricao: number;
  categoria: number;
  valor: number;
  saldo: number;
}

/** Fronteiras das colunas a partir do PRÓPRIO cabeçalho, em vez de X cravados
 *  como no ActivoBank: o mesmo extrato muda de largura conforme a moeda e o
 *  tamanho dos rótulos, e cada conta traz o seu cabeçalho.
 *
 *  `linhas[i]` é a linha candidata a cabeçalho. "Dinheiro a entrar/sair" e
 *  "Imposto retido" quebram em duas linhas de texto, por isso o "Dinheiro a"
 *  aparece na linha de cima (ou na de baixo, se o PDF as ordenar ao contrário)
 *  — daí procurar-se também nas vizinhas. */
function colunasRevolut(linhas: ItemTexto[][], i: number): ColunasRevolut | null {
  const cabecalho = linhas[i];
  const xDe = (re: RegExp, onde: ItemTexto[]) =>
    onde.find((it) => re.test(it.str.trim()))?.transform[4];

  const data = xDe(/^Data$/i, cabecalho);
  const descricao = xDe(/^Descri[çc][ãa]o$/i, cabecalho);
  const categoria = xDe(/^Categoria$/i, cabecalho);
  const saldo = xDe(/^Saldo$/i, cabecalho);
  const vizinhas = [...(linhas[i - 1] ?? []), ...cabecalho, ...(linhas[i + 1] ?? [])];
  const valor = xDe(/^Dinheiro\b/i, vizinhas);

  if ([data, descricao, categoria, valor, saldo].some((x) => x === undefined)) return null;
  // Pela ordem esperada — senão não é este cabeçalho, é texto que calhou.
  if (!(data! < descricao! && descricao! < categoria! && categoria! < valor! && valor! < saldo!))
    return null;
  return {
    data: data!,
    descricao: descricao!,
    categoria: categoria!,
    valor: valor!,
    saldo: saldo!,
  };
}

/** Revolut: uma linha de texto por movimento, mais linhas de continuação só
 *  com o resto da descrição (nome comprido de quem recebe a transferência,
 *  p.ex.) — essas não têm data nem números e juntam-se à linha anterior.
 *
 *  Linhas "Total" e resumos não têm data na primeira coluna e são ignoradas. */
export function extrairRevolut(paginas: ItemTexto[][]): LinhaExtrato[] {
  const linhasExtrato: LinhaExtrato[] = [];
  /** Último movimento lido, para lhe colar a continuação da descrição. */
  let ultimo: LinhaExtrato | null = null;

  for (const itens of paginas) {
    const linhas = agruparPorLinha(
      itens.filter((i) => i.str.trim()),
      3,
    );
    const iCabecalho = linhas.findIndex((_, i) => colunasRevolut(linhas, i) !== null);
    if (iCabecalho < 0) continue; // página de resumo, de informação legal, etc.
    const col = colunasRevolut(linhas, iCabecalho)!;

    // Tabela nova nesta página: a descrição de uma conta não continua noutra.
    const antesDoCabecalho = linhas
      .slice(0, iCabecalho)
      .map((l) => l.map((i) => i.str).join(" "))
      .join(" ");
    if (RE_TABELA_REVOLUT.test(antesDoCabecalho)) ultimo = null;

    for (const linha of linhas.slice(iCabecalho + 1)) {
      const naColuna = (de: number, ate: number) =>
        linha
          .filter(
            (i) =>
              i.transform[4] >= de - TOL_COLUNA_REVOLUT &&
              i.transform[4] < ate - TOL_COLUNA_REVOLUT,
          )
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((i) => i.str.trim())
          .filter(Boolean);

      const naData = naColuna(col.data, col.descricao);
      const descricao = naColuna(col.descricao, col.categoria).join(" ").trim();
      const naValor = naColuna(col.valor, col.saldo);
      const mData = RE_DATA_REVOLUT.exec(naData[0] ?? "");

      if (!mData) {
        // Continuação: só texto na coluna da descrição, nada mais na linha.
        if (ultimo && descricao && !naData.length && !naValor.length) {
          ultimo.descricao = `${ultimo.descricao} ${descricao}`.trim();
        }
        continue;
      }

      // Daqui para baixo é uma linha de movimento: mesmo que seja descartada
      // (moeda diferente, valor zero…), a continuação dela não pode ir colar-se
      // à descrição do movimento anterior, que é outro.
      ultimo = null;

      const dia = +mData[1];
      const mes = +mData[2];
      if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;
      if (!descricao) continue;

      const bruto = naValor[0];
      if (!bruto) continue;
      // O extrato traz uma tabela por conta, e as contas podem ser noutra
      // moeda (USD, …). O app lança tudo em euros: importar $ como € seria
      // errar o valor em silêncio, por isso essas linhas ficam de fora.
      if (/[$£]/.test(bruto)) continue;
      const valor = parseMoney(bruto);
      if (valor === null || valor === 0) continue;

      const movimento: LinhaExtrato = {
        data: `${mData[3]}-${pad2(mes)}-${pad2(dia)}`,
        descricao,
        valor,
      };
      linhasExtrato.push(movimento);
      ultimo = movimento;
    }
  }

  return linhasExtrato;
}

/** Reconstrói o texto de páginas quaisquer: uma linha por coordenada Y, itens
 *  ordenados por X dentro da linha. */
function reconstruirTexto(paginas: ItemTexto[][]): string {
  return paginas
    .map((itens) =>
      agruparPorLinha(itens, 2)
        .map((linha) =>
          linha
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map((i) => i.str.trim())
            .filter(Boolean)
            .join(" "),
        )
        .join("\n"),
    )
    .join("\n");
}

/** Lê um extrato em PDF e devolve as linhas cruas, prontas para `analisarLinha`.
 *  `buffer` é o ArrayBuffer do ficheiro.
 *
 *  Tudo aqui é avaro com memória, e não por gosto: o processo da aba no iPhone
 *  tem um teto muito mais baixo que o do Mac, e um extrato de 13 páginas com
 *  fontes embutidas chegava para o WebKit matar a página ("A problem
 *  repeatedly occurred"). Daí a página ser limpa assim que se lê o texto dela,
 *  o documento ser destruído no fim aconteça o que acontecer, e as fontes nem
 *  chegarem a ser construídas. */
export async function extrairExtratoPdf(buffer: ArrayBuffer): Promise<LinhaExtrato[]> {
  const pdfjs = await carregarPdfJs();
  // `disableFontFace`: por omissão o pdf.js converte cada fonte embutida em
  // OpenType e prende-a ao documento, para conseguir DESENHAR o PDF. Aqui
  // nunca se desenha nada — só se lê texto e coordenadas —, portanto isso era
  // memória gasta em algo que ninguém ia ver. Não mexe no texto extraído: o
  // mapa de caracteres para letras é lido no worker, à parte disto.
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true });

  try {
    const pdf = await tarefa.promise;
    const paginas: ItemTexto[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);

      // O texto vem pelo stream, lido com um reader — e NÃO por
      // `pagina.getTextContent()`, que faria o mesmo numa linha. Por dentro,
      // esse atalho percorre este stream com `for await (… of stream)`, ou
      // seja iteração assíncrona sobre um ReadableStream, que o WebKit não
      // implementa: no Safari rebentava aqui com "undefined is not a function",
      // dentro do pdf.js, antes de ler fosse o que fosse. E como no iOS todo o
      // navegador corre sobre WebKit (o "Chrome" do iPhone incluído), a
      // importação de PDF estava partida no telemóvel para todos os bancos.
      // Ler o stream à mão é o que o próprio pdf.js faz por baixo.
      const leitor = pagina.streamTextContent().getReader();
      const itens: ItemTexto[] = [];
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        // O fluxo traz também marcadores de conteúdo, que não têm texto nem
        // posição. Copiado para a forma local em vez de importar o tipo interno
        // do PDF.js, que muda de caminho entre versões.
        for (const item of value.items) {
          if ("str" in item) itens.push({ str: item.str, transform: item.transform });
        }
      }
      paginas.push(itens);

      // Página lida: larga já o que ela tinha em cache (fontes, glifos), em vez
      // de o guardar até ao fim do documento. `itens` são só texto e
      // coordenadas, já copiados — não dependem de nada disto.
      pagina.cleanup();
    }

    // Amostra do início para reconhecer o formato, como no original.
    const amostra = paginas
      .slice(0, 3)
      .map((itens) =>
        itens
          .slice(0, 60)
          .map((i) => i.str)
          .join(" "),
      )
      .join(" ");

    // A fatura de cartão tem de ser testada ANTES do ActivoBank genérico: o
    // nome do banco aparece no rodapé dela também, e sem isto caía no extrair
    // da conta à ordem e devolvia lista vazia. Procura-se no documento todo, e
    // não só na amostra do início — o "DETALHE DOS MOVIMENTOS" só aparece
    // depois das páginas de resumo.
    const textoTudo = paginas.map((itens) => itens.map((i) => i.str).join(" ")).join(" ");
    if (RE_CARTAO_SECAO.test(textoTudo) && RE_CARTAO_TITULO.test(textoTudo))
      return extrairActivoBankCartao(paginas);

    if (RE_ACTIVOBANK.test(amostra)) return extrairActivoBank(paginas);

    // Antes da Wise, e exigindo as duas marcas: "Revolut" sozinho podia
    // aparecer na descrição de um movimento noutro banco.
    //
    // Sem recurso ao genérico de propósito: esta tabela tem quatro números
    // depois do valor (saldo e três de imposto/comissão) e o genérico, que
    // espera um só, cola-os todos à descrição. Uma lista vazia mostra "nenhuma
    // linha reconhecida"; sujar o histórico do usuário em silêncio é pior.
    if (RE_REVOLUT.test(amostra) && RE_REVOLUT_TITULO.test(amostra)) return extrairRevolut(paginas);

    if (RE_WISE.test(amostra)) {
      // Se o cabeçalho é da Wise mas a tabela não é a esperada, o genérico
      // ainda fica com a sua hipótese em vez de devolver nada.
      const wise = extrairWise(paginas);
      if (wise.length) return wise;
    }

    return parseExtratoTextoLivre(reconstruirTexto(paginas));
  } finally {
    // Fecha o documento e o worker — com o `finally`, também quando uma página
    // rebenta a meio ou o formato não é reconhecido. Nesta versão quem destrói
    // é a tarefa de carregamento: `PDFDocumentProxy` já não tem `destroy()`.
    await tarefa.destroy();
  }
}
