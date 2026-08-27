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

const RESPOSTA_GEMINI = {
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({ candidates: [{ content: { parts: [{ text: "Resposta do modelo." }] } }] }),
};

/** Mock de `fetch` que distingue o pedido pelo URL: RTDB (cota) vs Gemini —
 *  desde que a cota do servidor passou a existir, cada pergunta já faz uma
 *  leitura + escrita no RTDB antes de sequer chegar ao Gemini. `leituraCota`
 *  e `escritaCota` são configuráveis por teste; a chamada ao Gemini usa
 *  sempre `RESPOSTA_GEMINI`, a não ser que o próprio teste substitua
 *  `globalThis.fetch` depois. */
function mockFetch(
  opts: {
    leituraCota?: () => { ok: boolean; status?: number; etag?: string | null; valor?: unknown };
    escritaCota?: () => { ok: boolean; status?: number };
  } = {},
) {
  const leituraCota =
    opts.leituraCota ?? (() => ({ ok: true, status: 200, etag: "etag-simulado", valor: 0 }));
  const escritaCota = opts.escritaCota ?? (() => ({ ok: true, status: 200 }));

  globalThis.fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = input;
    if (url.includes("firebasedatabase.app")) {
      if (init?.method === "PUT") {
        const r = escritaCota();
        return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), headers: new Headers() };
      }
      const r = leituraCota();
      const headers = new Headers();
      if (r.etag) headers.set("ETag", r.etag);
      return {
        ok: r.ok,
        status: r.status ?? (r.ok ? 200 : 500),
        headers,
        json: async () => r.valor ?? 0,
      };
    }
    return RESPOSTA_GEMINI;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jwtVerify.mockReset();
  jwtVerify.mockResolvedValue({ payload: { sub: "u1" } });
  process.env.GEMINI_API_KEY = "chave-de-teste";
  mockFetch();
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
    const chamadas = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.some(([u]) => String(u).includes("generativelanguage.googleapis.com"))).toBe(
      true,
    );
  });
});

describe("cota do servidor (fecho para quem chama o endpoint fora da app)", () => {
  test("cota do dia já esgotada no RTDB: 429, nunca chama o Gemini", async () => {
    mockFetch({ leituraCota: () => ({ ok: true, etag: "e1", valor: 20 }) });

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(429);
    expect(await corpoDaResposta(r)).toEqual({ erro: "cota" });
    const chamadas = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.some(([u]) => String(u).includes("generativelanguage.googleapis.com"))).toBe(
      false,
    );
  });

  test("leitura da cota falha (RTDB indisponível): 429, nunca chama o Gemini", async () => {
    mockFetch({ leituraCota: () => ({ ok: false }) });

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(429);
    const chamadas = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(chamadas.some(([u]) => String(u).includes("generativelanguage.googleapis.com"))).toBe(
      false,
    );
  });

  test("leitura sem ETag: 429, nunca chama o Gemini (sem ETag não há como escrever condicional)", async () => {
    mockFetch({ leituraCota: () => ({ ok: true, etag: null, valor: 0 }) });

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(429);
  });

  test("escrita perde a corrida do ETag sempre (412): 429 depois de 3 tentativas, nunca chama o Gemini", async () => {
    mockFetch({ escritaCota: () => ({ ok: false, status: 412 }) });

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(429);
    const chamadasRtdb = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) =>
      String(u).includes("firebasedatabase.app"),
    );
    // 3 tentativas × (1 leitura + 1 escrita) = 6.
    expect(chamadasRtdb).toHaveLength(6);
  });

  test("cota livre: escreve o incremento (valor+1) e chega a chamar o Gemini", async () => {
    mockFetch({ leituraCota: () => ({ ok: true, etag: "e1", valor: 3 }) });

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(200);
    const escrita = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u, init]) =>
        String(u).includes("firebasedatabase.app") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(escrita?.[1]).toMatchObject({ body: "4", headers: { "if-match": "e1" } });
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
    globalThis.fetch = vi.fn(async (input: string) => {
      const url = input;
      // A cota tem de passar para o pedido chegar ao Gemini — só a chamada
      // ao Gemini em si falha aqui.
      if (url.includes("firebasedatabase.app")) {
        return { ok: true, status: 200, headers: new Headers({ ETag: "e1" }), json: async () => 0 };
      }
      return { ok: false, status: 500, headers: new Headers(), json: async () => ({}) };
    }) as unknown as typeof fetch;

    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(503);
  });

  test("resposta do Gemini vem no corpo, com status 200", async () => {
    const r = await handler(pedido({ token: "token-valido" }));

    expect(r.status).toBe(200);
    expect(await corpoDaResposta(r)).toEqual({ resposta: "Resposta do modelo." });
  });
});
