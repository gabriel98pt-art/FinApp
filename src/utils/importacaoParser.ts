// Parser de extrato bancário colado/carregado (CSV ou texto delimitado),
// portado de _impCSV/_impCSVLine/_impFindCol/_impDate do financas.html.
// Bank-agnóstico: detecta o delimitador e acha as colunas pelo cabeçalho.

import type { LinhaExtrato } from "../types";
import { parseMoney } from "./money";

function dividirLinhaCsv(linha: string, delim: string): string[] {
  const res: string[] = [];
  let cur = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      // Aspas duplicadas dentro de um campo entre aspas (`""`) são o escape
      // padrão (RFC 4180) para uma aspa literal — sem isto, `"Nome ""X"" Lda"`
      // perdia as aspas internas em vez de as manter no texto.
      if (dentroAspas && linha[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      dentroAspas = !dentroAspas;
      continue;
    }
    if (c === delim && !dentroAspas) {
      res.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  res.push(cur.trim());
  return res;
}

function acharColuna(cabecalho: string[], candidatos: string[]): number {
  for (const cand of candidatos) {
    for (let i = 0; i < cabecalho.length; i++) {
      if (cabecalho[i].includes(cand)) return i;
    }
  }
  return -1;
}

/** Interpreta datas 'DD/MM/AAAA', 'DD-MM-AA' ou 'AAAA-MM-DD'. */
function interpretarData(s: string): string | null {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mes = m[2].padStart(2, "0");
    const dia = m[1].padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }
  m = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const RE_DATA_SOLTA = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
/* DESVIO DELIBERADO do original (`_impTXT`), que usava
   `\d{1,3}(?:[.,]\d{3})*[.,]\d{2}`: a parte inteira ficava limitada a 3 dígitos
   quando não havia separador de milhar, então "1850,00" batia só em "850,00" e
   entrava como 850 € — dinheiro truncado em silêncio, e o "1" ainda ia para a
   descrição. O ramo `\d+` cobre o caso sem separador; o ramo agrupado continua
   a ler "1.234,56". Nada que batia antes deixa de bater. */
const RE_VALOR_SOLTO = /([+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)[.,]\d{2})\b/;

/** Texto sem cabeçalho, uma transação por linha: acha a data e o valor onde
 *  estiverem e o que sobra é a descrição. Portado do ramo de varredura por
 *  linha de `_impTXT`, e é o que come o texto reconstruído de um PDF genérico
 *  (ver `extrairExtratoPdf`) — ali não há cabeçalho de coluna para casar. */
export function parseExtratoTextoLivre(texto: string): LinhaExtrato[] {
  const linhasExtrato: LinhaExtrato[] = [];
  const vistas = new Set<string>();
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha.length < 8) continue;
    const mData = RE_DATA_SOLTA.exec(linha);
    if (!mData) continue;
    // SEGUNDO DESVIO, mesma razão: o original procurava o valor na linha
    // inteira, e numa data com pontos ("10.07.2026") o próprio "10.07" batia
    // como valor antes de se chegar ao valor verdadeiro. Tira-se a data do
    // caminho primeiro.
    const semData = linha.replace(mData[0], " ");
    const mValor = RE_VALOR_SOLTO.exec(semData);
    if (!mValor) continue;
    const data = interpretarData(mData[0]);
    const valor = parseMoney(mValor[1]);
    if (!data || valor === null || valor === 0) continue;
    const descricao = semData
      .replace(mValor[1], "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[-–|:\s]+|[-–|:\s]+$/g, "")
      .trim();
    const chave = `${data}|${valor}|${descricao}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    linhasExtrato.push({ data, descricao, valor });
  }
  return linhasExtrato;
}

function detectarDelim(linha: string): string {
  let delim = "\t";
  const pontoVirgula = (linha.match(/;/g) || []).length;
  const virgula = (linha.match(/,/g) || []).length;
  if (pontoVirgula >= virgula) delim = ";";
  else if (virgula > 1) delim = ",";
  return delim;
}

interface CabecalhoAchado {
  delim: string;
  colData: number;
  colDesc: number;
  colValor: number;
  colDebito: number;
  colCredito: number;
}

/** Testa se UMA linha, sozinha, é um cabeçalho de colunas reconhecível. Só
 *  qualifica com data E algum tipo de valor (valor único ou débito/crédito)
 *  — sem isso, textos de metadados (ex.: "Data de abertura" numa linha de
 *  info de conta) dariam falso positivo só pela palavra "data" sozinha. */
function acharCabecalho(linha: string): CabecalhoAchado | null {
  const delim = detectarDelim(linha);
  const cabecalho = dividirLinhaCsv(linha, delim).map((h) =>
    h.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, " ").trim(),
  );
  const colData = acharColuna(cabecalho, ["data movimento", "data valor", "data", "date", "datum"]);
  const colDesc = acharColuna(cabecalho, [
    "descrição",
    "descricao",
    "descr",
    "description",
    "memo",
    "historico",
    "narrativa",
    "obs",
  ]);
  const colValor = acharColuna(cabecalho, [
    "valor",
    "value",
    "amount",
    "montante",
    "importância",
    "importancia",
    // Revolut chama a coluna de valor "Dinheiro a entrar/sair" (extrato
    // consolidado), não "valor" — sem isto a coluna nunca era achada.
    "dinheiro a entrar/sair",
    "dinheiro a entrar",
  ]);
  const colDebito = acharColuna(cabecalho, ["débito", "debito", "debit", "saída", "saida"]);
  const colCredito = acharColuna(cabecalho, ["crédito", "credito", "credit", "entrada"]);
  if (colData < 0 || (colValor < 0 && colDebito < 0 && colCredito < 0)) return null;
  return { delim, colData, colDesc, colValor, colDebito, colCredito };
}

/** Parser genérico de CSV/texto delimitado (_impCSV). Detecta ; , ou tab;
 *  acha colunas de data/descrição/valor (ou débito+crédito separados) pelo
 *  nome do cabeçalho, em qualquer ordem.
 *
 *  O cabeçalho não precisa estar na primeira linha: extratos "consolidados"
 *  (ex.: Revolut) empilham várias tabelas num único ficheiro — conta em EUR,
 *  conta em USD, cripto — cada uma com dezenas de linhas de metadados e
 *  saldos antes do seu próprio cabeçalho de transações. O parser varre
 *  TODA linha à procura de algo que bata como cabeçalho; ao achar um, passa
 *  a usar as colunas dele até achar outro (nova tabela) ou uma linha "Total"
 *  (fim da tabela). Sem isto, um ficheiro assim não reconhecia nenhuma
 *  linha — o cabeçalho real nunca estava na linha 1. */
export function parseExtratoCsv(texto: string): LinhaExtrato[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length < 2) return [];

  const linhasExtrato: LinhaExtrato[] = [];
  let cabecalhoAtual: CabecalhoAchado | null = null;

  for (const linha of linhas) {
    const possivelCabecalho = acharCabecalho(linha);
    if (possivelCabecalho) {
      cabecalhoAtual = possivelCabecalho;
      continue;
    }
    if (!cabecalhoAtual) continue;
    if (/^total\b/i.test(linha)) {
      cabecalhoAtual = null;
      continue;
    }

    const { delim, colData, colDesc, colValor, colDebito, colCredito } = cabecalhoAtual;
    const cols = dividirLinhaCsv(linha, delim);
    if (cols.length < 2) continue;
    const data = interpretarData(colData >= 0 ? cols[colData] : "");
    if (!data) continue;
    const descricao = (colDesc >= 0 ? cols[colDesc] : "").replace(/^"|"$/g, "").trim();

    let valor: number | null;
    if (colValor >= 0) {
      valor = parseMoney(cols[colValor]);
    } else {
      const debito = colDebito >= 0 ? (parseMoney(cols[colDebito]) ?? 0) : 0;
      const credito = colCredito >= 0 ? (parseMoney(cols[colCredito]) ?? 0) : 0;
      valor = credito > 0 ? credito : -Math.abs(debito);
    }
    if (valor === null || valor === 0) continue;
    linhasExtrato.push({ data, descricao, valor });
  }
  return linhasExtrato;
}
