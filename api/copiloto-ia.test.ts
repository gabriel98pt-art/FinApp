// A camada 2 do Copiloto, do lado do servidor — zero testes antes deste
// arquivo (achado da auditoria de Segurança e de Testes/QA: fora do include
// de cobertura, nem aparecia no relatório). O que se protege aqui é
// exatamente o achado crítico: sem um ID token do Firebase válido, o
// endpoint tem de recusar ANTES de gastar a GEMINI_API_KEY — não depois.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const jwtVerify = vi.fn();

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "jwks-simulado"),
  jwtVerify,
}));

const handler = (await import("./copiloto-ia.js")).default;

const CORPO_VALIDO = {
  pergunta: "Quanto gastei este mês?",
  resumo: { total: "€ 100,00" },
  tom: "direto",
};

function pedido(opts: { corpo?: unknown; token?: string; metodo?: string } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== undefined) headers.Authorization = `Bearer ${opts.token}`;
  return new Request("http://localhost/api/copiloto-ia", {
    method: opts.metodo ?? "POST",
    headers,
    body: opts.metodo === "GET" ? undefined : JSON.stringify(opts.corpo ?? CORPO_VALIDO),
  });
}

async function corpoDaResposta(r: Response): Promise<Record<string, unknown>> {
  return (await r.json()) as Record<string, unknown>;
}

const chaveOriginal = process.env.GEMINI_API_KEY;

beforeEach(() => {
  jwtVerify.mockReset();
  jwtVerify.mockResolvedValue({ payload: { sub: "u1" } });
  process.env.GEMINI_API_KEY = "chave-de-teste";
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "Resposta do modelo." }] } }] }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  process.env.GEMINI_API_KEY = chaveOriginal;
});

describe("autenticação (achado crítico da auditoria)", () => {
  test("sem cabeçalho Authorization: 401, nunca chama o Gemini", async () => {
    const r = await handler(pedido({ token: undefined }));

    expect(r.status).toBe(401);
    expect(await corpoDaResposta(r)).toEqual({ erro: "naoAutenticado" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  test("token que não verifica (assinatura inválida, expirado...): 401, nunca chama o Gemini", async () => {
    jwtVerify.mockRejectedValue(new Error("assinatura inválida"));

    const r = await handler(pedido({ token: "qualquer-coisa" }));

    expect(r.status).toBe(401);
    expect(await corpoDaResposta(r)).toEqual({ erro: "naoAutenticado" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("token verificado mas sem 'sub' (uid): 401", async () => {
    jwtVerify.mockResolvedValue({ payload: {} });

    const r = await handler(pedido({ token: "token-sem-sub" }));

    expect(r.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("token válido: passa da autenticação e chega a chamar o Gemini", async () => {
    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});

describe("o resto do contrato, sem mudança de comportamento", () => {
  test("método diferente de POST: 405", async () => {
    const r = await handler(pedido({ metodo: "GET" }));
    expect(r.status).toBe(405);
  });

  test("sem GEMINI_API_KEY configurada: 503, mesmo com token válido", async () => {
    delete process.env.GEMINI_API_KEY;

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(503);
    expect(await corpoDaResposta(r)).toEqual({ erro: "indisponivel" });
  });

  test("corpo sem 'pergunta': 400", async () => {
    const r = await handler(
      pedido({ token: "token-valido", corpo: { resumo: {}, tom: "direto" } }),
    );
    expect(r.status).toBe(400);
  });

  test("corpo sem 'resumo': 400", async () => {
    const r = await handler(
      pedido({ token: "token-valido", corpo: { pergunta: "oi", tom: "direto" } }),
    );
    expect(r.status).toBe(400);
  });

  test("pergunta acima de 500 caracteres: 400", async () => {
    const r = await handler(
      pedido({
        token: "token-valido",
        corpo: { pergunta: "a".repeat(501), resumo: {}, tom: "direto" },
      }),
    );
    expect(r.status).toBe(400);
  });

  test("JSON malformado no corpo: 400", async () => {
    const req = new Request("http://localhost/api/copiloto-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-valido" },
      body: "{ isto não é json",
    });
    const r = await handler(req);
    expect(r.status).toBe(400);
  });

  test("Gemini indisponível (resposta não-ok): 503", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(503);
  });

  test("resposta do Gemini vem no corpo, com status 200", async () => {
    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(200);
    expect(await corpoDaResposta(r)).toEqual({ resposta: "Resposta do modelo." });
  });
});
