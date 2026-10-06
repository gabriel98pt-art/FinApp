// Backup completo da conta (seção 4.6): exporta toda a árvore fin_v5 como
// JSON pra download, e restaura de um arquivo.
//
// Restaurar SOBRESCREVE a conta inteira. Por isso a ordem dentro de
// `importarBackup` é fixa e não negociável:
//   1. validar o arquivo por completo (`validarArquivoBackup`);
//   2. gravar uma cópia de segurança dos dados ATUAIS no próprio RTDB
//      (`users/{uid}/_seguranca/snapshotAntesRestauracao`);
//   3. só então sobrescrever `fin_v5`.
// Se o passo 2 falhar, o passo 3 não acontece — nunca se apaga nada sem a
// cópia já estar guardada. A cópia vive no RTDB e não em memória porque tem de
// sobreviver a um reload ou a um crash a meio da restauração.

import { get, ref, set } from "firebase/database";
import { db } from "./firebase";

const raiz = (uid: string) => `users/${uid}/fin_v5`;

/** Slot ÚNICO da rede de segurança: cada restauração sobrescreve o anterior.
 *  Não é um histórico — é só o "restaurei o arquivo errado, quero voltar". Fica
 *  fora de `fin_v5` de propósito: dentro dele, a própria restauração apagá-lo-ia
 *  (o `set` em `fin_v5` substitui tudo o que lá está). `apagarConta` remove
 *  `users/{uid}` inteiro, por isso a cópia sai junto com a conta. */
export const caminhoSnapshotDeSeguranca = (uid: string) =>
  `users/${uid}/_seguranca/snapshotAntesRestauracao`;

/** Única versão do formato que existe hoje. */
const VERSAO_ATUAL = 1;

interface ArquivoBackup {
  versao: 1;
  exportadoEm: string;
  dados: unknown;
}

/** O que fica gravado no slot de segurança. */
interface SnapshotDeSeguranca {
  versao: 1;
  criadoEm: string;
  dados: Record<string, unknown>;
}

/** Coleções de lançamentos/registos que no RTDB vivem como mapa `{id: item}`.
 *  Um array ou um primitivo no lugar de qualquer uma delas quer dizer que o
 *  arquivo não saiu do FinApp (ou foi mexido à mão) — e restaurá-lo deixaria a
 *  conta num formato que o app não sabe ler. */
const COLECOES_MAPA = [
  "receitas",
  "despesasFixas",
  "despesasCorrentes",
  "parcelas",
  "eventos",
  "fundos",
  "transferencias",
] as const;

/** As que contam como "lançamentos" no resumo mostrado antes de restaurar. */
const COLECOES_LANCAMENTOS = [
  "receitas",
  "despesasFixas",
  "despesasCorrentes",
  "parcelas",
] as const;

export interface ResumoBackup {
  /** Data ISO gravada no arquivo, ou `null` se faltar / for inválida. */
  exportadoEm: string | null;
  /** receitas + despesasFixas + despesasCorrentes + parcelas. */
  totalLancamentos: number;
  /** Instituições (contas) em `cfg.instituicoes`; em contas ainda não
   *  migradas, cai para `cfg.contasCartoes`. `null` se o arquivo não tiver
   *  nenhuma das duas. */
  contas: number | null;
  /** `cfg.categoriasDespesa`, ou `null` se o arquivo não a tiver. */
  categorias: number | null;
}

export type ResultadoValidacao =
  { ok: true; dados: Record<string, unknown>; resumo: ResumoBackup } | { ok: false; erro: string };

const ERRO_JSON = "Arquivo não é um JSON válido.";
const ERRO_FORMATO = "Formato de backup não reconhecido.";

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Quantos itens tem uma lista vinda do RTDB — que pode chegar como array
 *  (listas de strings, ex. `categoriasDespesa`) ou como mapa por id. */
function contarItens(v: unknown): number | null {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined).length;
  if (ehObjeto(v)) return Object.keys(v).length;
  return null;
}

/** Lê e valida o arquivo de backup POR INTEIRO, sem escrever nada. Usada pela
 *  tela (para mostrar o resumo antes de pedir confirmação) e pelo próprio
 *  `importarBackup` (que nunca confia que a tela já validou). */
export function validarArquivoBackup(json: string): ResultadoValidacao {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, erro: ERRO_JSON };
  }

  // `typeof null === "object"` em JavaScript: sem a checagem de `null`, um
  // ficheiro com `{"dados": null}` passava e o `set` recebia null — que no
  // RTDB não grava nada, APAGA o nó. Restaurar um backup malformado apagava a
  // conta inteira, em silêncio e sem volta.
  if (!ehObjeto(parsed) || !("dados" in parsed) || !ehObjeto(parsed.dados)) {
    return { ok: false, erro: ERRO_FORMATO };
  }
  const dadosObj = parsed.dados;

  // Arquivos sem `versao` são aceites como versão 1: é o único formato que
  // alguma vez existiu, e recusá-los partiria backups bem formados feitos à
  // mão ou por versões muito antigas. Com `versao` presente, tem de ser uma
  // que este código saiba ler.
  if ("versao" in parsed && parsed.versao !== VERSAO_ATUAL) {
    return {
      ok: false,
      erro: `Versão de backup não suportada (${JSON.stringify(parsed.versao)}). Este app só lê a versão ${VERSAO_ATUAL}.`,
    };
  }

  if ("cfg" in dadosObj && !ehObjeto(dadosObj.cfg)) {
    return { ok: false, erro: "O arquivo tem as configurações (“cfg”) num formato inesperado." };
  }
  for (const colecao of COLECOES_MAPA) {
    if (colecao in dadosObj && !ehObjeto(dadosObj[colecao])) {
      return {
        ok: false,
        erro: `O arquivo tem “${colecao}” num formato inesperado (deveria ser um mapa de itens por id).`,
      };
    }
  }

  let totalLancamentos = 0;
  for (const colecao of COLECOES_LANCAMENTOS) {
    totalLancamentos += contarItens(dadosObj[colecao]) ?? 0;
  }

  const cfg = ehObjeto(dadosObj.cfg) ? dadosObj.cfg : {};
  const contas = contarItens(cfg.instituicoes) ?? contarItens(cfg.contasCartoes);
  const categorias = contarItens(cfg.categoriasDespesa);

  const exportadoEmBruto = parsed.exportadoEm;
  const exportadoEm =
    typeof exportadoEmBruto === "string" && !Number.isNaN(new Date(exportadoEmBruto).getTime())
      ? exportadoEmBruto
      : null;

  return {
    ok: true,
    dados: dadosObj,
    resumo: { exportadoEm, totalLancamentos, contas, categorias },
  };
}

/** Leitura dos dados atuais da conta — partilhada entre a exportação e a
 *  cópia de segurança, para as duas guardarem exatamente o mesmo. O RTDB
 *  devolve null numa conta vazia; aqui isso vira `{}`. */
async function lerDadosAtuais(uid: string): Promise<Record<string, unknown>> {
  const snap = await get(ref(db, raiz(uid)));
  return (snap.val() as Record<string, unknown> | null) ?? {};
}

export async function exportarBackup(uid: string): Promise<string> {
  const arquivo: ArquivoBackup = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    dados: await lerDadosAtuais(uid),
  };
  return JSON.stringify(arquivo, null, 2);
}

/** Grava os dados ATUAIS da conta no slot de segurança. Lança se falhar —
 *  quem chama tem de abortar a restauração nesse caso. */
async function salvarSnapshotDeSeguranca(uid: string): Promise<void> {
  const snapshot: SnapshotDeSeguranca = {
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados: await lerDadosAtuais(uid),
  };
  await set(ref(db, caminhoSnapshotDeSeguranca(uid)), snapshot);
}

/** Sobrescreve TODOS os dados da conta pelo conteúdo do backup — depois de
 *  validar o arquivo e de guardar uma cópia de segurança do estado atual. */
export async function importarBackup(uid: string, json: string): Promise<void> {
  const resultado = validarArquivoBackup(json);
  if (!resultado.ok) throw new Error(resultado.erro);

  try {
    await salvarSnapshotDeSeguranca(uid);
  } catch {
    throw new Error(
      "Não foi possível criar a cópia de segurança dos dados atuais — nada foi alterado.",
    );
  }

  await set(ref(db, raiz(uid)), resultado.dados);
}

/** Desfaz a última restauração: repõe em `fin_v5` os dados guardados no slot
 *  de segurança antes dela. O slot NÃO é alterado — se a pessoa se arrepender
 *  outra vez, a cópia continua lá (trocar os dois de lugar exigiria guardar o
 *  estado atual por cima do slot antes de o ler de volta, e um crash entre as
 *  duas escritas perderia a cópia boa). */
export async function restaurarSnapshotDeSeguranca(uid: string): Promise<void> {
  const snap = await get(ref(db, caminhoSnapshotDeSeguranca(uid)));
  const valor = snap.val() as Partial<SnapshotDeSeguranca> | null;
  if (!ehObjeto(valor) || typeof valor.criadoEm !== "string") {
    throw new Error("Não há cópia de segurança para restaurar.");
  }
  // Conta que estava VAZIA antes da restauração: o RTDB não guarda objetos
  // vazios, então `dados: {}` volta sem a chave `dados`. Repor isso é repor
  // a conta vazia, não um erro.
  if (valor.dados !== undefined && !ehObjeto(valor.dados)) {
    throw new Error("A cópia de segurança guardada está corrompida.");
  }
  await set(ref(db, raiz(uid)), valor.dados ?? {});
}
