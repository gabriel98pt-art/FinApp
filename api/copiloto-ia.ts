// Camada 2 do Copiloto — função serverless da Vercel.
//
// Existe por uma razão só: a chave do Gemini não pode estar no browser. Tudo o
// que vai no bundle vai também para quem abrir as ferramentas de programador,
// e uma chave exposta é uma chave a ser gasta por estranhos. Aqui ela vive em
// `GEMINI_API_KEY`, variável de ambiente do projeto na Vercel.
//
// A Vercel reconhece `api/` sozinha; não é preciso `vercel.json`.
//
// Este ficheiro é deliberadamente autónomo — não importa nada de `src/`. Corre
// noutro sítio, com outro tsconfig, e o que entra aqui vem de um pedido HTTP:
// mesmo que o cliente seja nosso, o que chega é validado como se não fosse.
//
// AUTENTICAÇÃO (achado da auditoria de Segurança): até um certo commit, este
// endpoint não verificava QUEM estava a chamar — qualquer pessoa na internet
// podia fazer o POST à mão e gastar a GEMINI_API_KEY do projeto, sem estar
// logada no FinApp. A cota de 20 perguntas/dia (`iaUsoService.ts`) era só do
// lado do cliente, então não protegia nada contra isso.
//
// Exige um ID token do Firebase (`Authorization: Bearer <token>`) e verifica
// a assinatura contra as chaves públicas do Google — sem precisar do
// firebase-admin (pesado, exige service account): o ID token é um JWT comum,
// e `jose` já sabe buscar e cachear JWKS remoto.
//
// COTA NO SERVIDOR (o "próximo passo" que ficara pendente): uma conta real,
// autenticada, ainda podia chamar este endpoint à mão (fora da app) além do
// seu próprio limite de 20/dia — o contador só existia no cliente
// (`iaUsoService.ts`), e nada impedia um pedido feito diretamente com um
// token válido de pular por cima dele. `consumirCotaServidor` fecha isto
// reescrevendo o mesmo nó do RTDB que o cliente já usa
// (`users/{uid}/fin_v5/iaUso/{dia}`), autenticado com o PRÓPRIO ID token já
// verificado acima — as Security Rules (`database.rules.json`) só deixam
// `auth.uid === uid` mexer nesse nó, então isto também dispensa
// firebase-admin.

import { createRemoteJWKSet, jwtVerify } from "jose";

/** O mesmo projectId de `src/services/firebase.ts` — duplicado aqui de
 *  propósito: este ficheiro não importa de `src/` (ver nota acima). */
const FIREBASE_PROJECT_ID = "finapp1-20d00";

/** O mesmo databaseURL de `src/services/firebase.ts`, duplicado pela mesma
 *  razão do FIREBASE_PROJECT_ID acima. */
const DATABASE_URL = "https://finapp1-20d00-default-rtdb.europe-west1.firebasedatabase.app";

/** O mesmo LIMITE_DIARIO_IA de `src/services/iaUsoService.ts`, duplicado pela
 *  mesma razão. Os dois têm de andar a par: o cliente já recusa perguntar
 *  depois deste número, e este ficheiro é só o fecho para quem contorna o
 *  cliente. */
const LIMITE_DIARIO_IA = 20;

/** Tenta consumir uma pergunta da cota diária do UID, escrevendo direto no
 *  RTDB com o ID token de quem pergunta.
 *
 *  Leitura + escrita condicional por ETag, não leitura-seguida-de-escrita:
 *  duas perguntas em paralelo da mesma conta (duas abas, telemóvel e
 *  desktop ao mesmo tempo) não podem ler o mesmo valor e escrever as duas o
 *  mesmo número — perderia uma unidade da cota. Mesma razão do
 *  `runTransaction` do lado do cliente; aqui é feito à mão com a API REST do
 *  RTDB (cabeçalho `X-Firebase-ETag` na leitura, `if-match` na escrita)
 *  porque o SDK do Firebase não corre neste ambiente serverless.
 *
 *  O dia usado é o de HOJE em UTC — não necessariamente o mesmo dia local de
 *  quem pergunta perto da meia-noite. Sem problema: o cliente já é quem
 *  decide o dia que conta para a pessoa (`iaUsoService.ts`); este é só o
 *  travão do servidor, e continua a limitar a mesma conta ao mesmo número de
 *  perguntas por dia, só que talvez não exactamente às 00h00 dela.
 *
 *  Devolve `false` em qualquer caso de insucesso — cota esgotada, leitura ou
 *  escrita do RTDB a falhar, ou três tentativas seguidas a perder a corrida
 *  do ETag. Sem conseguir contar com confiança, o seguro é não deixar
 *  chamar a IA, mesmo que isso recuse, raramente, um pedido legítimo por uma
 *  falha que não é dele. */
async function consumirCotaServidor(uid: string, token: string): Promise<boolean> {
  const dia = new Date().toISOString().slice(0, 10);
  const url = `${DATABASE_URL}/users/${uid}/fin_v5/iaUso/${dia}.json?auth=${encodeURIComponent(token)}`;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    let atual: number;
    let etag: string | null;
    try {
      const leitura = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
      if (!leitura.ok) return false;
      etag = leitura.headers.get("ETag");
      const valor: unknown = await leitura.json();
      atual = typeof valor === "number" ? valor : 0;
    } catch {
      return false;
    }

    if (atual >= LIMITE_DIARIO_IA || !etag) return false;

    try {
      const escrita = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "if-match": etag },
        body: JSON.stringify(atual + 1),
      });
      // 412: o ETag mudou entre a leitura e a escrita — outra pergunta da
      // mesma conta ganhou a corrida. Tenta de novo com o valor mais recente.
      if (escrita.status === 412) continue;
      return escrita.ok;
    } catch {
      return false;
    }
  }
  return false;
}

/** JWKS público do Firebase Auth (chaves de assinatura dos ID tokens) — o
 *  `jose` busca e cacheia entre invocações a frio, sem precisar de rede a
 *  cada pedido. */
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

/** Verifica um ID token do Firebase. Devolve o uid quando válido, `null`
 *  quando não — nunca lança, para o handler poder tratar tudo como 401. */
async function uidDoToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Flash: o escalão que existe no nível gratuito e é largamente suficiente
 *  para escrever três frases sobre números que já vão prontos. Configurável
 *  por variável de ambiente para poder trocar de versão sem novo deploy de
 *  código. */
const MODELO_PADRAO = "gemini-2.0-flash";

/** Respostas curtas de propósito: isto é uma caixa num cartão do dashboard,
 *  não um chat. */
const MAX_TOKENS = 400;

const TIMEOUT_MS = 10000;

interface CorpoPedido {
  pergunta: string;
  resumo: unknown;
  tom: string;
}

function json(dados: unknown, status: number): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** O cliente é nosso, mas o pedido chega pela rede: qualquer um pode fazer
 *  este POST à mão. */
function lerCorpo(bruto: unknown): CorpoPedido | null {
  if (!bruto || typeof bruto !== "object") return null;
  const c = bruto as Record<string, unknown>;
  if (typeof c.pergunta !== "string" || !c.pergunta.trim()) return null;
  // Um limite grosseiro chega: trava um pedido absurdo sem inventar regras
  // sobre o que alguém pode querer perguntar.
  if (c.pergunta.length > 500) return null;
  if (!c.resumo || typeof c.resumo !== "object") return null;
  return {
    pergunta: c.pergunta,
    resumo: c.resumo,
    tom: c.tom === "direto" ? "direto" : "acolhedor",
  };
}

function instrucoes(tom: string): string {
  const vozes: Record<string, string> = {
    direto: "Escreve de forma direta e seca. Sem rodeios, sem simpatias.",
    acolhedor: "Escreve de forma calma e próxima, como quem ajuda sem julgar.",
  };

  return [
    "És o assistente financeiro de uma app pessoal chamada FinApp e respondes sempre em português de Portugal.",
    vozes[tom] ?? vozes.acolhedor,
    "Responde em 3 frases no máximo.",
    "",
    "REGRAS QUE NÃO PODES QUEBRAR:",
    "- Usa APENAS os valores que te são dados no resumo. Nunca inventes um número.",
    "- Nunca faças contas: nem somas, nem percentagens, nem divisões. Os valores já vêm calculados e formatados; cita-os tal como estão.",
    "- Se a pergunta precisar de um número que não está no resumo, diz que não tens esse dado.",
    "- Não escrevas HTML nem markdown. Texto simples.",
    "- Não peças dados pessoais nem sugiras produtos financeiros de terceiros.",
  ].join("\n");
}

async function perguntarAoGemini(
  chave: string,
  modelo: string,
  corpo: CorpoPedido,
): Promise<string | null> {
  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      signal: controlador.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instrucoes(corpo.tom) }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Resumo da conta (valores já formatados, não os recalcules):",
                  JSON.stringify(corpo.resumo, null, 2),
                  "",
                  `Pergunta: ${corpo.pergunta}`,
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: MAX_TOKENS },
      }),
    });

    if (!r.ok) return null;

    const dados = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  const uid = token ? await uidDoToken(token) : null;
  if (!token || !uid) return json({ erro: "naoAutenticado" }, 401);

  const chave = process.env.GEMINI_API_KEY;
  // Sem chave configurada a app não parte: o cliente trata qualquer resposta
  // que não seja 200 da mesma maneira e mostra a mensagem única.
  if (!chave) return json({ erro: "indisponivel" }, 503);

  let bruto: unknown;
  try {
    bruto = await req.json();
  } catch {
    return json({ erro: "corpo" }, 400);
  }

  const corpo = lerCorpo(bruto);
  if (!corpo) return json({ erro: "corpo" }, 400);

  // Fecho da cota do lado do servidor — ver a nota em `consumirCotaServidor`.
  // Verificado só agora (depois da chave e do corpo) para não gastar uma
  // escrita no RTDB por um pedido que ia ser recusado de qualquer forma.
  if (!(await consumirCotaServidor(uid, token))) return json({ erro: "cota" }, 429);

  const resposta = await perguntarAoGemini(chave, process.env.GEMINI_MODEL || MODELO_PADRAO, corpo);
  if (!resposta) return json({ erro: "indisponivel" }, 503);

  return json({ resposta }, 200);
}
