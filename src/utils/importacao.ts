// Motor de importação de extrato bancário — classificação e deduplicação,
// portados do financas.html (linhas ~7794-7876 classificação, ~7961-8025
// dedup). Funções puras, sem dependência de Firebase/DOM.

import type {
  CargaEletrica,
  Cents,
  Classificacao,
  Confianca,
  DecisaoLinha,
  ExistenteParaDedup,
  LinhaAnalisada,
  LinhaExtrato,
  Parcela,
  ResultadoDuplicata,
  StatusDuplicata,
  TipoClassificado,
} from "../types";
import { mesDe } from "./calculos";
import { formatCents } from "./money";
import { valorDaParcela } from "./parcelas";

/** Normaliza uma descrição bancária pra comparação — remove IBANs, referências
 *  Multibanco, acentos, sufixos empresariais etc. Não altera texto exibido,
 *  só uso interno de comparação. Portado tal como está (_impNorm). */
export function normalizarDescricao(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[àáâãä]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/ç/g, "c")
      .replace(/ñ/g, "n")
      // IBANs: PT50xxxx... ou outros países
      .replace(/\b[a-z]{2}\d{2}[\s-]?(?:[a-z0-9]{4}[\s-]?){3,7}[a-z0-9]{0,4}\b/gi, " ")
      // Referências Multibanco: entidade 12345 ref 123456789
      .replace(/\bentidade\s*\d+\s*(?:ref(?:er[eê]ncia)?\s*)?\d*/gi, " ")
      // Referências em 3 grupos de 3 dígitos
      .replace(/\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/g, " ")
      // REF / NIF / IBAN / códigos bancários
      .replace(/\bref[:\s#.]*[a-z0-9]*/gi, " ")
      .replace(/\b(nif|nipc|iban|proc|doc\s*n[ro]?|nib|bic|swift)\s*[:\s#]?[a-z0-9]*/gi, " ")
      // IDs longos (>= 6 dígitos isolados)
      .replace(/\b\d{6,}\b/g, " ")
      // Tokens bancários de canal
      .replace(
        /\b(tpa|pos\b|atm\b|dd\b|mbway|mb\b|compra\s+no\s+pa[ií]s|pagamento\s+no\s+exterior)\b/gi,
        " ",
      )
      // Datas embutidas
      .replace(/\d{2}[/-]\d{2}(?:[/-]\d{2,4})?/g, " ")
      // Sufixos empresariais
      .replace(/\b(lda|unip|s\.?a\.?|s\.?l\.?|ltda|plc|ltd|inc|sgps)\b/g, " ")
      // Símbolos desnecessários
      .replace(/[*#@|<>()\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Similaridade Jaccard sobre palavras normalizadas (só palavras > 2 letras).
 *  Portado tal como está (_impSim). */
export function similaridadeDescricoes(a: string, b: string): number {
  const na = normalizarDescricao(a);
  const nb = normalizarDescricao(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = na.split(" ");
  const wb = nb.split(" ");
  const setB = new Set(wb.filter((w) => w.length > 2));
  let hits = 0;
  for (const w of wa) if (w.length > 2 && setB.has(w)) hits++;
  const longA = wa.filter((w) => w.length > 2).length;
  const longB = setB.size;
  const uniao = longA + longB - hits;
  return uniao > 0 ? hits / uniao : 0;
}

/** Regras de palavras-chave (_IMP_RULES), portadas tal como estão. Tipos
 *  'veh_cg'/'veh_lp' do app de origem (cargas elétricas / despesas do
 *  veículo) mapeiam pra despesa comum categoria 'Veículo' — o FinApp ainda
 *  não tem os domínios próprios de veículo (chegam num marco futuro). */
interface RegraImportacao {
  tipo: "receita" | "despesa" | "fatura" | "transferencia";
  categoria: string | null;
  palavras: string[];
}

export const REGRAS_IMPORTACAO: RegraImportacao[] = [
  {
    tipo: "receita",
    categoria: null,
    palavras: [
      "vencimento",
      "salário",
      "salario",
      "ordenado",
      "remuner",
      "subsidio",
      "sub. aliment",
      "abono",
      "transfer. recebida",
      "transf. recebida",
      "trf recebida",
      "pagamento recebido",
      "liquidação recebida",
      "transferencia - vencimento",
      "trf. p/o",
      "credito cashback",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Veículo",
    palavras: [
      "mobi.e",
      "voltacharge",
      "carga elétrica",
      "carga electrica",
      "chargepoint",
      "ionity",
      "fastned",
      "power dot",
      "galp",
      "repsol",
      "bp ",
      "shell",
      "combustivel",
      "gasolineira",
      "posto de abast",
      "petrol",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Telemóvel",
    palavras: ["nos ", "meo ", "vodafone", "nowo", "digi ", "altice", "dd meo"],
  },
  {
    tipo: "despesa",
    categoria: "Mercado",
    palavras: [
      "continente",
      "pingo doce",
      "lidl",
      "aldi",
      "mercadona",
      "intermarché",
      "intermarch",
      "minipreco",
      "jumbo",
      "el corte",
      "continente bom dia",
      "continente pay",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Restaurante",
    palavras: [
      "restaurante",
      "snack",
      "cafe ",
      "cafetaria",
      "cafeteria",
      "padaria",
      "pastelaria",
      "tasca",
      "pizz",
      "burger",
      "mcdonalds",
      "kfc",
      "subway",
      "nandos",
      "kebab",
      "doner",
      "champions burger",
      "montaditos",
      "book.it",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Saúde",
    palavras: [
      "farmácia",
      "farmacia",
      "hospital",
      "clinica",
      "clínica",
      "consulta",
      "médico",
      "medico",
      "dentista",
      "fisio",
      "laborat",
      "cuf diagnost",
      "pagserv",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Lazer",
    palavras: [
      "cinema",
      "teatro",
      "spotify",
      "netflix",
      "disney",
      "apple music",
      "amazon prime",
      "hbo",
    ],
  },
  {
    tipo: "despesa",
    categoria: "Contas de Casa",
    palavras: [
      "edp ",
      "epal",
      "dgeg",
      "água",
      "aguas ",
      "eletricidade",
      "gás ",
      "gas ",
      "condomínio",
      "condominio",
    ],
  },
  { tipo: "despesa", categoria: "Aluguel", palavras: ["renda ", "arrendamento", "aluguer"] },
  { tipo: "despesa", categoria: "Portagens", palavras: ["viaverde", "via verde"] },
  {
    tipo: "despesa",
    categoria: "Seguro",
    palavras: [
      "seguro",
      "insurance",
      "allianz",
      "fidelidade",
      "zurich",
      "ageas",
      "tranquilidade",
      "dd ocidental",
      "dd cartrack",
      "medis",
    ],
  },
  { tipo: "despesa", categoria: "Prestação", palavras: ["pag.prestacao", "pag. prestacao"] },
  {
    tipo: "fatura",
    categoria: "Cartão de Crédito",
    palavras: [
      "pagamento cartão",
      "pag. cartão",
      "pagamento visa",
      "pagamento mastercard",
      "liquidação cartão",
      "pgto cart",
      "vis pagamento cartao credito",
    ],
  },
  {
    tipo: "transferencia",
    categoria: "Transferência",
    palavras: [
      "transferência",
      "transferencia",
      "trf para",
      "trf de",
      "mbway",
      "trf p/",
      "trf mb way p/",
      "wise",
      "wise.com",
      "transferwise",
    ],
  },
];

export interface ContextoClassificacao {
  parcelas: Parcela[];
  /** Categorias já configuradas na conta (fixas + correntes). */
  categoriasConfiguradas: string[];
  /** Despesas que o usuário já lançou — a memória de que categoria ele dá a
   *  cada sítio. Só os dois campos que interessam à comparação. */
  despesasHistorico: { descricao: string; categoria: string }[];
  /** O mesmo para as receitas, onde o papel da categoria é da fonte. */
  receitasHistorico: { descricao: string; fonte: string }[];
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Fronteira de palavra escrita à mão em vez de `\b`: o texto cru guarda
   acentos e, para o `\b` do JS, "á" não é letra — `\bágua` nunca bateria em
   "água" no início de uma descrição. O início consome o caractere anterior
   (só interessa o sim/não do teste, nunca a posição). */
const LETRA = "\\p{L}\\p{N}";
const INICIO = `(?:^|[^${LETRA}])`;
const FIM = `(?![${LETRA}])`;

const padroes = new Map<string, RegExp>();

/** Uma palavra-chave tem de bater em fronteira de palavra, não em qualquer
 *  pedaço de texto: era assim que "nos " (a operadora) se apanhava dentro de
 *  "diagnost" e mandava uma despesa de Saúde para Telemóvel. Mesma família do
 *  bug do "mbway" anotado abaixo — o espaço no fim de "nos " era para servir de
 *  fronteira, mas `normalizarDescricao` apara-o antes da comparação.
 *
 *  Duas convenções da lista de palavras a respeitar, daí o `fechaPalavra`:
 *  - espaço no fim = "aqui acaba a palavra" ("bp ", "gas ", "meo ", "nos ");
 *  - sem espaço = prefixo DE PROPÓSITO — "pizz" tem de continuar a pegar
 *    "pizzaria", "laborat" a pegar "laboratório", "cuf diagnost" a pegar
 *    "cuf diagnostico".
 *  A fronteira do início vale sempre; a do fim só quando a palavra a pedia. */
function bateComoPalavra(texto: string, alvo: string, fechaPalavra: boolean): boolean {
  if (!alvo) return false;
  const chave = `${fechaPalavra ? "1" : "0"}${alvo}`;
  let re = padroes.get(chave);
  if (!re) {
    re = new RegExp(`${INICIO}${escaparRegex(alvo)}${fechaPalavra ? FIM : ""}`, "u");
    padroes.set(chave, re);
  }
  return re.test(texto);
}

/** O sinal do valor contradiz o tipo? Só a receita entra dinheiro; despesa e
 *  fatura são sempre saída. Uma condição só para os três, em vez de uma lista
 *  de casos que já esqueceu dois: era a despesa a bater com valor positivo (o
 *  estorno do supermercado) que passava sem ninguém dar por ela.
 *
 *  `transferencia` fica de fora: aí o dinheiro pode ir nos dois sentidos, e
 *  entrar tem um significado próprio — ver `analisarLinha`. */
function sinalContradiz(tipo: TipoClassificado, isCredit: boolean): boolean {
  if (tipo === "transferencia") return false;
  return (tipo === "receita") !== isCredit;
}

/** Mesmo limiar do "nome parecido" das parcelas (passo 1) — o problema é o
 *  mesmo (duas descrições bancárias do mesmo sítio) e não havia razão para
 *  inventar outro número. */
const SIM_APRENDIDA = 0.65;

/** O que o usuário já fez com uma descrição parecida a esta.
 *
 *  Procura no histórico dele — despesas se a linha é saída, receitas se é
 *  entrada — a descrição mais parecida acima do limiar, e devolve a categoria
 *  (ou fonte) daquele lançamento. Fica com a de MAIOR semelhança: com "Uber
 *  Eats" repetido dezenas de vezes na mesma categoria, contar votos daria o
 *  mesmo resultado com mais código.
 *
 *  Os dois lados nunca se misturam: uma categoria de despesa não pode ir
 *  parar a uma receita só porque o texto se parecia. */
function categoriaAprendida(tx: LinhaExtrato, ctx: ContextoClassificacao): Classificacao | null {
  const ehReceita = tx.valor > 0;
  const candidatos = ehReceita
    ? ctx.receitasHistorico.map((r) => ({ descricao: r.descricao, categoria: r.fonte }))
    : ctx.despesasHistorico.map((d) => ({ descricao: d.descricao, categoria: d.categoria }));

  let melhor: { descricao: string; categoria: string } | null = null;
  let melhorSim = 0;
  for (const c of candidatos) {
    if (!c.descricao || !c.categoria) continue;
    const sim = similaridadeDescricoes(c.descricao, tx.descricao);
    if (sim >= SIM_APRENDIDA && sim > melhorSim) {
      melhorSim = sim;
      melhor = c;
    }
  }
  if (!melhor) return null;

  return {
    tipo: ehReceita ? "receita" : "despesa",
    categoria: melhor.categoria,
    incerto: false,
    // Foi o usuário que decidiu isto — não há palpite nenhum aqui.
    confianca: "high",
    motivo: `aprendido: ${melhor.descricao}`,
  };
}

/** Classificação em cascata (_impClassify): parcela → despesa fixa (não
 *  aplicável — sem domínio próprio ainda) → categoria configurada → palavras-
 *  chave → fallback. Para na primeira que bater. */
export function classificarLancamento(tx: LinhaExtrato, ctx: ContextoClassificacao): Classificacao {
  const origL = (tx.descricao || "").toLowerCase();
  const normL = normalizarDescricao(tx.descricao);
  const isCredit = tx.valor > 0;
  const abs = Math.abs(tx.valor);

  // 1. Parcelas: exige nome similar + valor (evita falsos positivos)
  for (const p of ctx.parcelas) {
    if (!p.descricao) continue;
    const sim = similaridadeDescricoes(p.descricao, tx.descricao);
    // Valor representativo da parcela — instalments são quase iguais por
    // construção (divisão exata em centavos, ver utils/parcelas.ts)
    const valorParcela = valorDaParcela(p, p.primeiroMes);
    const valOk = Math.abs(valorParcela - abs) < 2;
    if (sim >= 0.65 && valOk) {
      return {
        tipo: "despesa",
        categoria: p.categoria || "Parcelas",
        incerto: false,
        confianca: "high",
        motivo: `parcela: ${p.descricao}`,
      };
    }
    if (sim >= 0.5 && valOk) {
      return {
        tipo: "despesa",
        categoria: p.categoria || "Parcelas",
        incerto: true,
        confianca: "medium",
        motivo: `parcela (valor+nome parcial): ${p.descricao}`,
      };
    }
    if (sim >= 0.82) {
      return {
        tipo: "despesa",
        categoria: p.categoria || "Parcelas",
        incerto: true,
        confianca: "medium",
        motivo: `parcela (só nome): ${p.descricao}`,
      };
    }
  }

  // 2. Despesas fixas: sem domínio próprio no FinApp ainda — passo mantido
  // como comentário-âncora pra quando esse domínio existir (a ordem da
  // cascata importa: fixas vêm ANTES das categorias configuradas genéricas).

  // 2.5. O que o próprio usuário já fez com uma descrição parecida.
  //
  // Vem antes das categorias configuradas e das regras genéricas porque é o
  // sinal mais forte que existe: não é uma palavra que calhou aparecer no
  // texto, é ele a ter classificado exatamente isto antes. "Uber Eats" não
  // bate em regra nenhuma, mas se já foi Restaurante das outras vezes, é
  // Restaurante desta.
  const aprendida = categoriaAprendida(tx, ctx);
  if (aprendida) return aprendida;

  // 3. Categorias já configuradas pelo usuário.
  // Sempre com fronteira dos dois lados: o nome de uma categoria escrita pelo
  // usuário ("Casa", "Metro") é para bater na palavra inteira. A convenção de
  // prefixo-sem-espaço é da lista de regras abaixo, não daqui — sem isso,
  // "Metro" apanharia "metropolitana" e "Casa" apanharia "casamento".
  for (const cat of ctx.categoriasConfiguradas) {
    const cn = normalizarDescricao(cat);
    if (bateComoPalavra(normL, cn, true) || bateComoPalavra(origL, cat.toLowerCase(), true)) {
      return {
        tipo: "despesa",
        categoria: cat,
        // Categoria de DESPESA a bater com dinheiro a entrar é contraditório —
        // o estorno do supermercado é isso mesmo. Sem esta marca a linha ia
        // direta a "auto-classificada" e passava como despesa sem ninguém
        // olhar para ela.
        incerto: sinalContradiz("despesa", isCredit),
        confianca: "high",
        motivo: `categoria: ${cat}`,
      };
    }
  }

  // 4. Regras de palavras-chave
  for (const regra of REGRAS_IMPORTACAO) {
    for (const kw of regra.palavras) {
      // BUG do app de referência a NÃO reproduzir: a palavra-chave 'mbway'
      // normaliza para string vazia (ela mesma é um dos tokens bancários que
      // normalizarDescricao remove de dentro de outras descrições) — e
      // texto.includes('') é sempre true em JS, então a regra bateria com
      // QUALQUER lançamento. Ignorar candidatos normalizados vazios; o
      // literal cru (origL.includes(kw)) abaixo já detecta "mbway" de verdade.
      const kwNormalizada = normalizarDescricao(kw);
      // O espaço no fim de "nos "/"bp " é a fronteira que a lista quis dizer, e
      // a normalização apara-o — daí guardar o sinal antes de comparar.
      const fechaPalavra = /\s$/.test(kw);
      if (
        bateComoPalavra(normL, kwNormalizada, fechaPalavra) ||
        bateComoPalavra(origL, kw.trimEnd(), fechaPalavra)
      ) {
        // Sinal inconsistente com o tipo: marcar como incerto.
        const incerto =
          sinalContradiz(regra.tipo, isCredit) || (regra.tipo === "transferencia" && isCredit);
        // A regra pode sugerir uma categoria (ex. "Veículo") que a conta não
        // tem configurada — cai explicitamente em "Outros" em vez de deixar
        // uma categoria inválida (o <select> na UI, sem essa opção, acaba
        // mostrando o primeiro item da lista por baixo do valor real).
        const categoria =
          regra.tipo === "despesa" &&
          regra.categoria !== null &&
          !ctx.categoriasConfiguradas.includes(regra.categoria)
            ? "Outros"
            : regra.categoria;
        return {
          tipo: regra.tipo,
          categoria,
          incerto,
          confianca: incerto ? "medium" : "high",
          motivo: `regra: "${kw}"`,
        };
      }
    }
  }

  // 5. Fallback — sem evidência suficiente
  return isCredit
    ? {
        tipo: "receita",
        categoria: null,
        incerto: true,
        confianca: "low",
        motivo: "sem correspondência",
      }
    : {
        tipo: "despesa",
        categoria: "Outros",
        incerto: true,
        confianca: "low",
        motivo: "sem correspondência",
      };
}

/** Score-based dedup (_impDupCheck): valor exato (tolerância 2 cêntimos) +
 *  mesmo sinal + janela de 14 dias (fora disso é recorrência legítima, não
 *  duplicata) + similaridade de descrição. */
export function verificarDuplicata(
  tx: LinhaExtrato,
  existentes: ExistenteParaDedup[],
  /** Comparar contra o sinal CONTRÁRIO em vez do mesmo. Serve um caso só: a
   *  linha é uma transferência entre contas do próprio usuário, e a outra
   *  ponta do mesmo dinheiro pode já estar lançada — como despesa se esta é
   *  receita, ou ao contrário. Ver `analisarLinha`. */
  sinalOposto = false,
): ResultadoDuplicata {
  const abs = Math.abs(tx.valor);
  const txIsCredit = tx.valor > 0;
  let melhor: ExistenteParaDedup | null = null;
  let melhorScore = 0;
  let melhorMotivos: string[] = [];

  for (const ex of existentes) {
    const exAbs = Math.abs(ex.valor);
    // valor* já em centavos inteiros — comparar direto (tolerância 2 cêntimos)
    if (Math.abs(exAbs - abs) >= 2) continue;
    const mesmoSinal = ex.valor > 0 === txIsCredit;
    if (mesmoSinal === sinalOposto) continue;

    const txD = new Date(tx.data + "T00:00:00").getTime();
    const exD = new Date(ex.data + "T00:00:00").getTime();
    const dd = Math.abs((txD - exD) / 86400000);
    if (dd > 14) continue;

    const motivos = [`Valor idêntico (${formatCents(abs)})`];
    let score = 20;

    if (dd === 0) {
      score += 35;
      motivos.push("Mesma data");
    } else if (dd <= 2) {
      score += 22;
      motivos.push(`Data muito próxima (${Math.round(dd)}d)`);
    } else if (dd <= 5) {
      score += 12;
      motivos.push(`Data próxima (${Math.round(dd)}d)`);
    } else {
      score += 4;
      motivos.push(`Dentro da janela de ${Math.round(dd)}d`);
    }

    const sim = similaridadeDescricoes(tx.descricao, ex.descricao);
    const pct = Math.round(sim * 100);
    if (sim >= 0.92) {
      score += 45;
      motivos.push(`Descrição quase idêntica (${pct}%)`);
    } else if (sim >= 0.85) {
      score += 40;
      motivos.push(`Descrição muito similar (${pct}%)`);
    } else if (sim >= 0.65) {
      score += 28;
      motivos.push(`Descrição similar (${pct}%)`);
    } else if (sim >= 0.45) {
      score += 15;
      motivos.push(`Descrição parcialmente similar (${pct}%)`);
    } else if (sim >= 0.25) {
      score += 6;
      motivos.push(`Descrição ligeiramente similar (${pct}%)`);
    } else if (dd === 0) {
      score = Math.min(score, 44);
      motivos.push("Descrição diferente — verificar conflito");
    }

    if (score > melhorScore) {
      melhorScore = score;
      melhor = ex;
      melhorMotivos = motivos;
    }
  }

  const nada: ResultadoDuplicata = {
    status: "new",
    confianca: null,
    correspondencia: null,
    score: 0,
    motivos: [],
  };
  if (!melhor || melhorScore < 24) return nada;

  let status: StatusDuplicata;
  let confianca: Confianca;
  if (melhorScore >= 95) {
    status = "exact_duplicate";
    confianca = "high";
  } else if (melhorScore >= 80) {
    status = "duplicate";
    confianca = "high";
  } else if (melhorScore >= 52) {
    status = "duplicate";
    confianca = "medium";
  } else if (melhorScore >= 32) {
    status = "possible";
    confianca = "low";
  } else {
    return nada;
  }

  return { status, confianca, correspondencia: melhor, score: melhorScore, motivos: melhorMotivos };
}

/* Palavras que dizem "isto foi um carregamento ELÉTRICO". Saem da regra de
   "Veículo" das REGRAS_IMPORTACAO, mas só a parte de eletricidade: galp,
   repsol, shell e companhia também são veículo e não são carga — pedir os kWh
   de um depósito de gasóleo era pior do que não sugerir nada. Sem os genéricos
   "carregamento"/"recarga": em português também são carregar saldo do telemóvel
   ou da conta, e apanhariam despesas que nada têm a ver com o carro.

   "powerdot" numa palavra só é o nome como aparece nos extratos reais; a lista
   das regras só tinha "power dot" com espaço. */
const PALAVRAS_CARGA = [
  "mobi.e",
  "mobie",
  "voltacharge",
  "carga elétrica",
  "carga electrica",
  "chargepoint",
  "ionity",
  "fastned",
  "power dot",
  "powerdot",
  "supercharger",
  "evio",
  "kwh",
];

/** Quanto de parecença chega para dar por reconhecido um local já cadastrado.
 *  Metade das palavras em comum: "IONITY GMBH" contra "Ionity A1" dá 0,5. */
const SIM_LOCAL_CARGA = 0.5;

export interface CargaReconhecida {
  /** A linha parece um carregamento elétrico. */
  ehCarga: boolean;
  /** Local já cadastrado que bate com a descrição — "" se nenhum bateu. */
  local: string;
}

/** Olha uma linha do extrato e diz se é candidata a recarga elétrica, e em que
 *  posto. Dois caminhos, do mais forte para o mais fraco:
 *
 *  1. bate com um local que o usuário já tem cadastrado (`cfg.locaisCarregamento`)
 *     — aí sabe-se também QUAL o posto;
 *  2. não bate com nenhum, mas o texto traz nome de rede de carregamento — dá
 *     para sugerir o destino, mas o local fica por escolher.
 *
 *  Só entradas negativas: uma carga é dinheiro a sair. */
export function reconhecerCarga(tx: LinhaExtrato, locais: string[]): CargaReconhecida {
  if (tx.valor >= 0) return { ehCarga: false, local: "" };

  const origL = (tx.descricao || "").toLowerCase();
  const normL = normalizarDescricao(tx.descricao);

  let melhorLocal = "";
  let melhorSim = 0;
  for (const local of locais) {
    const normLocal = normalizarDescricao(local);
    if (!normLocal) continue;
    // Peso das palavras em comum, e não "o nome do posto aparece na
    // descrição": um local de nome genérico como "Casa" está escrito dentro de
    // "CASA DAS RAÇÕES ANIMAIS", e isso não é carregamento nenhum. Assim,
    // quanto mais a descrição fala de outra coisa, menos ela vale.
    const sim = similaridadeDescricoes(normL, normLocal);
    if (sim >= SIM_LOCAL_CARGA && sim > melhorSim) {
      melhorSim = sim;
      melhorLocal = local;
    }
  }
  if (melhorLocal) return { ehCarga: true, local: melhorLocal };

  for (const kw of PALAVRAS_CARGA) {
    const fechaPalavra = /\s$/.test(kw);
    if (
      bateComoPalavra(normL, normalizarDescricao(kw), fechaPalavra) ||
      bateComoPalavra(origL, kw.trimEnd(), fechaPalavra)
    ) {
      return { ehCarga: true, local: "" };
    }
  }
  return { ehCarga: false, local: "" };
}

/** kWh prováveis desta recarga, a partir do que aquele posto costumava
 *  custar — devolve o texto do campo ("43,75"), ou "" quando não há por onde
 *  estimar.
 *
 *  O extrato traz o custo mas nunca a energia. O que o app sabe é o preço por
 *  kWh das cargas anteriores NAQUELE posto: com ele, custo ÷ preço dá os kWh
 *  sem ninguém escrever nada. Usa-se a carga mais recente do local, não uma
 *  média — o preço da eletricidade muda, e o valor de há um ano diria menos
 *  do que o do mês passado.
 *
 *  É um ponto de partida, não uma verdade: o campo continua editável. */
export function estimarKwh(custo: Cents, local: string, cargas: CargaEletrica[]): string {
  const alvo = local.trim();
  if (!alvo) return "";
  let referencia: CargaEletrica | null = null;
  for (const c of cargas) {
    if (c.local !== alvo || c.precoKwh <= 0) continue;
    if (!referencia || c.data > referencia.data) referencia = c;
  }
  if (!referencia) return "";
  const kwh = Math.round((custo / referencia.precoKwh) * 100) / 100;
  if (!Number.isFinite(kwh) || kwh <= 0) return "";
  return String(kwh).replace(".", ",");
}

export interface ContextoAnalise extends ContextoClassificacao {
  existentes: ExistenteParaDedup[];
  /** Postos de carregamento cadastrados, para reconhecer recargas. */
  locaisCarregamento: string[];
  /** Cargas já registadas — é delas que sai o preço por kWh de cada posto. */
  cargasHistorico: CargaEletrica[];
}

/** Decisão final por linha (_impAnalyze): combina classificação + dedup. */
export function analisarLinha(tx: LinhaExtrato, id: number, ctx: ContextoAnalise): LinhaAnalisada {
  const classificacao = classificarLancamento(tx, ctx);
  const duplicata = verificarDuplicata(tx, ctx.existentes);

  let decisao: DecisaoLinha;
  if (duplicata.status === "exact_duplicate") decisao = "duplicata_provavel";
  else if (duplicata.status === "duplicate" && duplicata.confianca === "high")
    decisao = "duplicata_provavel";
  else if (duplicata.status !== "new") decisao = "revisao";
  else if (classificacao.confianca === "high" && !classificacao.incerto)
    decisao = "auto_classificada";
  else decisao = "nova";

  const acao: "import" | "skip" = duplicata.status === "new" ? "import" : "skip";

  // Recarga elétrica já vem sugerida como destino quando a linha tem cara
  // disso: falta sempre o kWh, que só o usuário sabe, e é a revisão que serve
  // para isso. Um toque no destino devolve a linha ao caminho normal.
  const carga = reconhecerCarga(tx, ctx.locaisCarregamento);

  // Bateu uma regra de transferência: dinheiro que muda de sítio entre contas
  // do próprio usuário, e não gasto nem ganho. Vale para os dois lados — o que
  // entra (a conta que recebe) e o que sai (a conta que manda). Antes só se
  // sugeria o lado de entrada, e as saídas iam parar a despesa comum, a inchar
  // o total de gastos com dinheiro que nunca saiu do bolso. Sugerido, não
  // imposto: um toque no destino devolve a linha ao caminho normal.
  const ehTransferencia = classificacao.tipo === "transferencia";

  // Pagamento da fatura do cartão: a regra de palavra-chave já o reconhece
  // ("PAGAMENTO CARTÃO DE CRÉDITO"), só faltava ter para onde o mandar. Como
  // despesa comum o dinheiro saía certo da conta, mas a aba Cartões nunca
  // ficava a saber que a fatura tinha sido paga.
  const ehPagamentoFatura = classificacao.tipo === "fatura";

  // Segunda passagem, só para transferências: o MESMO dinheiro pode já estar
  // no app pelo outro lado, lançado como despesa comum se esta linha é receita
  // (ou ao contrário) — por exemplo se foi registado antes de existir o
  // destino "transferência", ou pelo registo rápido. A comparação normal nunca
  // o encontra, porque só olha para existentes do mesmo sinal. Isto é aviso,
  // não veredito: nada fica bloqueado nem desmarcado por causa dele.
  const outraPonta = ehTransferencia
    ? (() => {
        const achado = verificarDuplicata(tx, ctx.existentes, true);
        return achado.status === "new" ? null : achado;
      })()
    : null;

  return {
    id,
    data: tx.data,
    descricao: tx.descricao,
    valor: tx.valor,
    classificacao,
    duplicata,
    decisao,
    acao,
    categoriaEscolhida: classificacao.categoria ?? "Outros",
    tipoEscolhido: classificacao.tipo === "receita" ? "receita" : "despesa",
    destino: carga.ehCarga
      ? "carga"
      : ehTransferencia
        ? "transferencia_cartao"
        : ehPagamentoFatura
          ? "pagamento_fatura"
          : "lancamento",
    contaEscolhida: "",
    localCarga: carga.local,
    kwhCarga: carga.ehCarga ? estimarKwh(Math.abs(tx.valor), carga.local, ctx.cargasHistorico) : "",
    contaOrigem: "",
    contaDestino: "",
    fatCartaoEscolhido: "",
    fatMesEscolhido: mesDe(tx.data),
    outraPonta,
  };
}
