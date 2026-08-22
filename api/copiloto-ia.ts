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
// AUTENTICAÇÃO (achado da auditoria de Segurança): até este commit, este
// endpoint não verificava QUEM estava a chamar — qualquer pessoa na internet
// podia fazer o POST à mão e gastar a GEMINI_API_KEY do projeto, sem estar
// logada no FinApp. A cota de 20 perguntas/dia (`iaUsoService.ts`) é só do
// lado do cliente, então não protegia nada contra isso.
//
// Agora exige um ID token do Firebase (`Authorization: Bearer <token>`) e
// verifica a assinatura contra as chaves públicas do Google — sem precisar do
// firebase-admin (pesado, exige service account): o ID token é um JWT comum,
// e `jose` já sabe buscar e cachear JWKS remoto. Continua sem mover a CONTA da
// cota para o servidor — isso protegeria contra uma conta real chamando além
// do seu próprio limite, um problema bem menor do que "qualquer estranho
// gasta a chave inteira". Fica como próximo passo, não parte deste commit.

import { createRemoteJWKSet, jwtVerify } from "jose";

/** O mesmo projectId de `src/services/firebase.ts` — duplicado aqui de
 *  propósito: este ficheiro não importa de `src/` (ver nota acima). */
const FIREBASE_PROJECT_ID = "finapp1-20d00";

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
  if (!token || !(await uidDoToken(token))) return json({ erro: "naoAutenticado" }, 401);

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

  const resposta = await perguntarAoGemini(chave, process.env.GEMINI_MODEL || MODELO_PADRAO, corpo);
  if (!resposta) return json({ erro: "indisponivel" }, 503);

  return json({ resposta }, 200);
}
