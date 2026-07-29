// Extração de extrato bancário em PDF, portada do financas.html
// (_loadPdfJs ~7315, _impParsePDF ~7636, _impActivoBankFromItems ~7681).
// Devolve `LinhaExtrato[]`, a mesma coisa que `parseExtratoCsv` — daí em
// diante o fluxo de importação (classificação, dedup, revisão) é o mesmo.
//
// Dois caminhos, como no original:
//  1. ActivoBank, reconhecido pelo cabeçalho: extração ciente das colunas,
//     usando a posição X de cada item do PDF. O valor de cada linha vem da
//     DIFERENÇA entre o saldo dela e o da linha anterior — mais confiável do
//     que ler a coluna de débito/crédito, que vem com espaçamento errático.
//  2. Qualquer outro banco: reconstrói as linhas de texto agrupando os itens
//     por coordenada Y (ordenados por X dentro da linha) e entrega esse texto
//     ao parser de texto livre que já existe.

import type { LinhaExtrato } from "../types";
import { parseExtratoTextoLivre } from "./importacaoParser";

/** Um item de texto do PDF.js reduzido ao que interessa aqui. */
interface ItemTexto {
  str: string;
  /** Matriz de transformação; [4] é o X e [5] o Y do item na página. */
  transform: number[];
}

/** PDF.js é pesado e só serve para importar extrato em PDF: entra por
 *  `import()` dinâmico, que o Vite fatia num chunk à parte — quem nunca
 *  importa um PDF nunca o descarrega. O worker vem do próprio pacote (`?url`),
 *  não de um CDN como no app antigo. */
async function carregarPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
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

/** Agrupa itens por linha (coordenada Y arredondada) e ordena de cima para
 *  baixo. `passo` maior tolera mais desalinhamento vertical dentro da linha. */
function agruparPorLinha<T extends ItemTexto>(itens: T[], passo: number): T[][] {
  const linhas = new Map<number, T[]>();
  for (const item of itens) {
    const y = Math.round(item.transform[5] / passo) * passo;
    const atual = linhas.get(y);
    if (atual) atual.push(item);
    else linhas.set(y, [item]);
  }
  return [...linhas.keys()].sort((a, b) => b - a).map((y) => linhas.get(y)!);
}

/** Extração coluna-a-coluna do ActivoBank (_impActivoBankFromItems). */
function extrairActivoBank(paginas: ItemTexto[][]): LinhaExtrato[] {
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

    for (const linha of agruparPorLinha(uteis, 6)) {
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
 *  `buffer` é o ArrayBuffer do ficheiro. */
export async function extrairExtratoPdf(buffer: ArrayBuffer): Promise<LinhaExtrato[]> {
  const pdfjs = await carregarPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const paginas: ItemTexto[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const conteudo = await pagina.getTextContent();
    // O fluxo traz também marcadores de conteúdo, que não têm texto nem posição.
    // Copiado para a forma local em vez de importar o tipo interno do PDF.js,
    // que muda de caminho entre versões.
    const itens: ItemTexto[] = [];
    for (const item of conteudo.items) {
      if ("str" in item) itens.push({ str: item.str, transform: item.transform });
    }
    paginas.push(itens);
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

  return RE_ACTIVOBANK.test(amostra)
    ? extrairActivoBank(paginas)
    : parseExtratoTextoLivre(reconstruirTexto(paginas));
}
