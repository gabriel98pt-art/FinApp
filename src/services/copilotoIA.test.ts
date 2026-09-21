// Camada 2 do Copiloto. O que se testa aqui é sobretudo o que ela NÃO pode
// fazer: partir o Copiloto quando o serviço externo falha, deixar passar
// HTML gerado, ou distinguir motivos de insucesso a quem pergunta.
//
// A cota diária de perguntas (20/dia) deixou de ser contada aqui — era
// (`iaUsoService.ts`, removido) e descontava a MESMA pergunta que
// `api/copiloto-ia.ts` já desconta do lado do servidor, no mesmo nó do RTDB;
// toda pergunta em uso normal gastava a cota duas vezes. Este ficheiro só
// distingue "sem sessão"/"sem token" (que nem chegam a chamar a API) de
// "a API recusou" (cota esgotada e qualquer outro insucesso do servidor
// tratados da mesma forma — ver "erro da API vira a mesma mensagem" abaixo).

import { beforeEach, describe, expect, test, vi } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ContextoCopiloto } from "../utils/copiloto";

/** `undefined` simula sessão sem token válido (ex. expirou entre o clique e
 *  o pedido) — api/copiloto-ia.ts agora exige esse token, então sem ele a
 *  chamada nem deve sair. */
let tokenAtual: string | undefined = "token-falso";

vi.mock("./firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return tokenAtual ? { getIdToken: async () => tokenAtual } : null;
    },
  },
}));

const s = await import("./copilotoIA");

function ctx(extra: Partial<ContextoCopiloto> = {}): ContextoCopiloto {
  return {
    receitas: [],
    despesas: [],
    despesasFixas: [],
    parcelas: [],
    veiculo: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
    eventos: [],
    fundos: [],
    cfg: CONFIG_PADRAO,
    mesReal: "2026-07",
    diaDeHoje: 15,
    ...extra,
  };
}

/** Última chamada ao fetch, para inspecionar o que saiu da app. */
function corpoEnviado(): Record<string, unknown> {
  const chamada = vi.mocked(globalThis.fetch).mock.calls[0];
  return JSON.parse(String((chamada[1] as RequestInit).body)) as Record<string, unknown>;
}

function respondeCom(dados: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => dados,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  tokenAtual = "token-falso";
  respondeCom({ resposta: "Aqui vai a resposta." });
});

describe("responderComIA — quando não responde", () => {
  test("sem sessão nem tenta chamar a API", async () => {
    expect(await s.responderComIA("e agora?", ctx(), undefined)).toBe(s.MENSAGEM_IA_INDISPONIVEL);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("cota do dia esgotada (429 do servidor) vira a mesma mensagem", async () => {
    // A cota é decidida só pelo servidor (`api/copiloto-ia.ts`), que devolve
    // 429 quando esgotada — ver a nota no topo do ficheiro sobre porque
    // deixou de haver um contador também aqui do lado do cliente.
    respondeCom({ erro: "cota" }, false);

    expect(await s.responderComIA("e agora?", ctx(), "u1")).toBe(s.MENSAGEM_IA_INDISPONIVEL);
  });

  test("erro da API vira a mesma mensagem", async () => {
    respondeCom({ erro: "indisponivel" }, false);

    expect(await s.responderComIA("e agora?", ctx(), "u1")).toBe(s.MENSAGEM_IA_INDISPONIVEL);
  });

  test("rede em baixo não rebenta o Copiloto", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("sem rede");
    }) as unknown as typeof fetch;

    await expect(s.responderComIA("e agora?", ctx(), "u1")).resolves.toBe(
      s.MENSAGEM_IA_INDISPONIVEL,
    );
  });

  test("resposta vazia conta como não ter respondido", async () => {
    respondeCom({ resposta: "   " });

    expect(await s.responderComIA("e agora?", ctx(), "u1")).toBe(s.MENSAGEM_IA_INDISPONIVEL);
  });

  test("sem token do Firebase (sessão a expirar entre o clique e o pedido) nem chama a API", async () => {
    // api/copiloto-ia.ts (achado da auditoria de Segurança) passou a exigir
    // um ID token válido — o cliente tem de ter um pra sequer tentar.
    tokenAtual = undefined;

    expect(await s.responderComIA("e agora?", ctx(), "u1")).toBe(s.MENSAGEM_IA_INDISPONIVEL);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("todos os motivos dão exactamente o mesmo texto", async () => {
    // Quem pergunta não tem de aprender a diferença entre "cota" e "erro de
    // API": em qualquer dos casos só há uma coisa a fazer, tentar mais tarde.
    const semSessao = await s.responderComIA("x", ctx(), undefined);

    respondeCom({ erro: "cota" }, false);
    const semCota = await s.responderComIA("x", ctx(), "u1");

    respondeCom({}, false);
    const comErro = await s.responderComIA("x", ctx(), "u1");

    expect(new Set([semSessao, semCota, comErro]).size).toBe(1);
    expect(semSessao).not.toMatch(/api|cota|erro|limite/i);
  });
});

describe("responderComIA — quando responde", () => {
  test("devolve o texto do modelo", async () => {
    expect(await s.responderComIA("e agora?", ctx(), "u1")).toBe("Aqui vai a resposta.");
  });

  test("escapa HTML — texto gerado não emite marcação", async () => {
    respondeCom({ resposta: "<img src=x onerror=alert(1)> olá" });

    const r = await s.responderComIA("e agora?", ctx(), "u1");

    // A resposta é injectada com dangerouslySetInnerHTML. Um modelo pode ser
    // levado a escrever isto por dados que a própria pessoa escreveu.
    expect(r).not.toContain("<img");
    expect(r).toContain("&lt;img");
  });
});

describe("o que sai da app", () => {
  test("vai a pergunta e o resumo agregado — as últimas compras vão, conta/cartão e id nunca", async () => {
    // ultimasTransacoes (copilotoResumo.ts) leva descrição de propósito, desde
    // 5d1f2bd — é o que permite responder "qual foi a minha última compra em
    // X". A fronteira real não é "nenhuma descrição", é "nunca conta/cartão
    // nem id do lançamento": testar com despesas vazias, como este teste fazia
    // antes, não verificava isso e ficava a afirmar o contrário do que o
    // código faz de propósito.
    const c = ctx({
      despesas: [
        {
          id: "id-unico-nao-pode-sair",
          descricao: "Compra no Continente",
          categoria: "Mercado",
          valor: 5000,
          data: "2026-07-10",
          contaCartao: "Visa terminado em 4321",
        },
      ],
    });
    await s.responderComIA("e agora?", c, "u1");
    const corpo = corpoEnviado();

    expect(corpo.pergunta).toBe("e agora?");
    expect(corpo.resumo).toBeTruthy();
    const cru = JSON.stringify(corpo);
    expect(cru).toContain("Compra no Continente");
    expect(cru).not.toMatch(/"despesas":\s*\[/);
    expect(cru).not.toMatch(/"receitas":\s*\[/);
    expect(cru).not.toContain("Visa");
    expect(cru).not.toContain("4321");
    expect(cru).not.toContain("id-unico-nao-pode-sair");
  });

  test("manda o ID token do Firebase no cabeçalho Authorization", async () => {
    await s.responderComIA("e agora?", ctx(), "u1");

    const chamada = vi.mocked(globalThis.fetch).mock.calls[0];
    const cabecalhos = (chamada[1] as RequestInit).headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBe("Bearer token-falso");
  });

  test("o tom por omissão da camada 2 é acolhedor, não o directo da camada 1", async () => {
    await s.responderComIA("e agora?", ctx(), "u1");

    expect(corpoEnviado().tom).toBe("acolhedor");
  });

  test("mas respeita quem escolheu 'direto' de propósito", async () => {
    const c = ctx({ cfg: { ...CONFIG_PADRAO, copiloto: { tom: "direto" } } });
    await s.responderComIA("e agora?", c, "u1");

    expect(corpoEnviado().tom).toBe("direto");
  });
});
