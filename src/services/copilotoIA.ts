// Camada 2 do Copiloto — o reforço para as perguntas que a camada 1 não sabe
// responder. Só é chamada depois de `responderPergunta` devolver
// `RESPOSTA_PADRAO`; nunca por cima de um número que a app calculou.
//
// A chave do Gemini não vive aqui nem em lado nenhum do browser: este ficheiro
// fala com `api/copiloto-ia.ts` (função da Vercel), e é lá que a chave existe,
// em variável de ambiente do servidor. Qualquer coisa que chegue ao bundle
// chega também a quem abrir as ferramentas de programador.

import type { ContextoCopiloto } from "../utils/copiloto";
import { escaparHtml } from "../utils/copiloto";
import { montarResumoParaIA } from "../utils/copilotoResumo";
import { auth } from "./firebase";

/** A ÚNICA mensagem de insucesso da camada 2.
 *
 *  Cota pessoal esgotada, cota gratuita do Gemini no fim, chave por configurar,
 *  API em baixo, rede a falhar — tudo diz isto. Distinguir os motivos daria a
 *  quem pergunta um vocabulário que não é dele ("erro de API", "quota") e
 *  informação que não lhe serve para nada: em qualquer dos casos a única coisa
 *  a fazer é tentar mais logo. */
export const MENSAGEM_IA_INDISPONIVEL = "Não consigo responder agora, tente depois.";

/** Ao fim disto, desistir. Uma resposta que demora mais do que isto já não
 *  chega a tempo de ser útil, e deixar a caixa "a pensar…" sem fim é pior do
 *  que dizer que não deu. */
const TIMEOUT_MS = 12000;

interface RespostaApi {
  resposta?: unknown;
}

/**
 * Pergunta à camada 2. Nunca lança: qualquer falha vira
 * `MENSAGEM_IA_INDISPONIVEL`, porque o Copiloto não pode partir por causa de
 * um serviço externo.
 */
export async function responderComIA(
  pergunta: string,
  ctx: ContextoCopiloto,
  uid: string | undefined,
): Promise<string> {
  // Sem sessão não há como autenticar o pedido ao servidor.
  if (!uid) return MENSAGEM_IA_INDISPONIVEL;

  // `api/copiloto-ia.ts` exige um ID token válido — sem ele, ou com sessão a
  // expirar entre o clique e o pedido, o servidor recusaria com 401 de
  // qualquer forma.
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) return MENSAGEM_IA_INDISPONIVEL;

  // Bug corrigido: esta função também descontava uma pergunta da cota diária
  // aqui, do lado do cliente (`consumirCotaIA`, `iaUsoService.ts`), ANTES de
  // chamar `api/copiloto-ia.ts` — que, desde a auditoria de Segurança, já
  // desconta a MESMA pergunta do MESMO nó do RTDB (`consumirCotaServidor`,
  // mesmo caminho `users/{uid}/fin_v5/iaUso/{dia}`). Toda pergunta feita pela
  // app em uso normal (não a contornar o cliente) descontava a cota DUAS
  // vezes, e o limite documentado/configurado de 20 perguntas por dia
  // (`LIMITE_DIARIO_IA`, duplicado nos dois ficheiros) na prática parava em
  // 10. `iaUsoService.ts` deixou de ser chamado daqui — e, sem mais nenhum
  // lugar a chamá-lo, foi removido (ver histórico do commit): o servidor já é
  // quem fecha a cota, com o mesmo travão de concorrência (ETag/if-match) que
  // o cliente tinha, e é ele quem também apanha quem contorna o cliente.
  //
  // A camada 1 assume "direto" por omissão porque é o fraseado histórico dela.
  // Aqui o padrão é outro: quem chega à camada 2 fez uma pergunta que a app
  // não soube responder, e nesse momento um tom acolhedor cai melhor do que um
  // telegrama. A preferência explícita de quem configurou ganha às duas.
  const tom = ctx.cfg.copiloto?.tom ?? "acolhedor";

  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const r = await fetch("/api/copiloto-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pergunta, resumo: montarResumoParaIA(ctx), tom }),
      signal: controlador.signal,
    });

    if (!r.ok) return MENSAGEM_IA_INDISPONIVEL;

    const dados = (await r.json()) as RespostaApi;
    const texto = typeof dados.resposta === "string" ? dados.resposta.trim() : "";
    if (!texto) return MENSAGEM_IA_INDISPONIVEL;

    // A resposta é renderizada com dangerouslySetInnerHTML (o <b> da camada 1).
    // Este texto vem de fora e passa por dados que a própria pessoa escreveu
    // — nomes de categoria e de fundo entram no pedido —, portanto é escapado
    // por inteiro. A camada 2 não ganha o direito de emitir HTML.
    return escaparHtml(texto);
  } catch {
    return MENSAGEM_IA_INDISPONIVEL;
  } finally {
    clearTimeout(relogio);
  }
}
