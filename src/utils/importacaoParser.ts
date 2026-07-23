// Parser de extrato bancário colado/carregado (CSV ou texto delimitado),
// portado de _impCSV/_impCSVLine/_impFindCol/_impDate do financas.html.
// Bank-agnóstico: detecta o delimitador e acha as colunas pelo cabeçalho.

import type { LinhaExtrato } from "../types";
import { parseMoney } from "./money";

function dividirLinhaCsv(linha: string, delim: string): string[] {
  const res: string[] = [];
  let cur = "";
  let dentroAspas = false;
  for (const c of linha) {
    if (c === '"') {
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

/** Parser genérico de CSV/texto delimitado (_impCSV). Detecta ; , ou tab;
 *  acha colunas de data/descrição/valor (ou débito+crédito separados) pelo
 *  nome do cabeçalho, em qualquer ordem. */
export function parseExtratoCsv(texto: string): LinhaExtrato[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length < 2) return [];

  const primeira = linhas[0];
  let delim = "\t";
  const pontoVirgula = (primeira.match(/;/g) || []).length;
  const virgula = (primeira.match(/,/g) || []).length;
  if (pontoVirgula >= virgula) delim = ";";
  else if (virgula > 1) delim = ",";

  const cabecalho = dividirLinhaCsv(primeira, delim).map((h) =>
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
  ]);
  const colDebito = acharColuna(cabecalho, ["débito", "debito", "debit", "saída", "saida"]);
  const colCredito = acharColuna(cabecalho, ["crédito", "credito", "credit", "entrada"]);

  const linhasExtrato: LinhaExtrato[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = dividirLinhaCsv(linhas[i], delim);
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
