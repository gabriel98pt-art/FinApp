import { describe, expect, test } from "vitest";
import {
  desfazer,
  empilhar,
  pilhaVazia,
  podeDesfazer,
  podeRefazer,
  refazer,
  type HistoricoStack,
} from "./historico";

describe("empilhar (snapshot) — seção 4.7", () => {
  test("empilha o estado pré-mutação, índice aponta pro topo", () => {
    let h = pilhaVazia();
    h = empilhar(h, "estado0");
    expect(h).toEqual({ pilha: ["estado0"], indice: 0 });
    h = empilhar(h, "estado1");
    expect(h).toEqual({ pilha: ["estado0", "estado1"], indice: 1 });
  });

  test("um novo snapshot depois de um undo trunca o redo pendente", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    h = empilhar(h, "s1");
    h = empilhar(h, "s2");
    // volta pro meio da pilha…
    h = { ...h, indice: 1 };
    // …e uma edição nova a partir daí apaga "s2" (futuro alternativo)
    h = empilhar(h, "s1b");
    expect(h.pilha).toEqual(["s0", "s1", "s1b"]);
    expect(h.indice).toBe(2);
  });

  test("limite de 50 entradas — descarta a mais antiga", () => {
    let h = pilhaVazia();
    for (let i = 0; i < 60; i++) h = empilhar(h, `estado${i}`);
    expect(h.pilha).toHaveLength(50);
    expect(h.pilha[0]).toBe("estado10"); // as 10 primeiras (0-9) foram descartadas
    expect(h.pilha[h.pilha.length - 1]).toBe("estado59");
    expect(h.indice).toBe(49);
  });
});

describe("desfazer — cenário EXATO do bug antigo (seção 4.7, NÃO reproduzir)", () => {
  test("2 edições seguidas + 1 undo reverte só a última, não as duas de uma vez", () => {
    let h = pilhaVazia();
    // edição 1: snapshot do estado antes dela
    h = empilhar(h, "estadoInicial");
    const estadoAposEdicao1 = "estadoAposEdicao1";
    // edição 2: snapshot do estado antes dela (= depois da edição 1)
    h = empilhar(h, estadoAposEdicao1);
    const estadoAoVivoAposEdicao2 = "estadoAposEdicao2"; // nunca empilhado ainda

    const r = desfazer(h, estadoAoVivoAposEdicao2);

    // Com a ordem CORRETA (captura o estado ao vivo antes de decrementar):
    // um único undo devolve o estado de depois da edição 1 — a edição 2 foi
    // desfeita, a edição 1 continua presente.
    //
    // Se a ordem fosse invertida (decrementa primeiro, sem capturar o estado
    // ao vivo — o bug documentado na spec), este mesmo undo pularia direto
    // pro "estadoInicial", perdendo a edição 1 em silêncio e sem chance de
    // redo recuperá-la (ela nunca teria sido empilhada). Esta asserção falha
    // nesse cenário buggy.
    expect(r.estado).toBe(estadoAposEdicao1);
    expect(r.estado).not.toBe("estadoInicial");
  });

  test("undo do estado ao vivo empilha ele — redo consegue voltar sem perder nada", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    h = empilhar(h, "s1");
    const vivo = "s2";

    const rUndo = desfazer(h, vivo);
    expect(rUndo.estado).toBe("s1");

    const rRedo = refazer(rUndo.h);
    expect(rRedo.estado).toBe(vivo); // "s2" recuperado — nada foi perdido
  });

  test("múltiplos undos consecutivos não pulam estados", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    h = empilhar(h, "s1");
    h = empilhar(h, "s2");
    const vivo = "s3";

    let r = desfazer(h, vivo);
    expect(r.estado).toBe("s2");
    r = desfazer(r.h, vivo);
    expect(r.estado).toBe("s1");
    r = desfazer(r.h, vivo);
    expect(r.estado).toBe("s0");
  });

  test("múltiplos redos consecutivos recuperam tudo, incluindo o estado ao vivo", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    h = empilhar(h, "s1");
    const vivo = "s2";

    let r = desfazer(h, vivo);
    r = desfazer(r.h, vivo);
    h = r.h;

    r = refazer(h);
    expect(r.estado).toBe("s1");
    r = refazer(r.h);
    expect(r.estado).toBe(vivo);
  });

  test("undo com só 1 entrada ainda funciona (mesmo com o botão desabilitado)", () => {
    // podeDesfazer() fica false aqui (índice=0 antes da chamada — ver o
    // describe de baixo), mas a função em si continua correta se forçada:
    // "vivo" é a edição real feita depois de empilhar "s0".
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    const r1 = desfazer(h, "vivo");
    expect(r1.estado).toBe("s0");
  });

  test("undo não faz nada quando já está no início da pilha (índice 0, sem estado ao vivo novo)", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    h = empilhar(h, "s1");
    let r = desfazer(h, "vivo");
    h = r.h;
    expect(r.estado).toBe("s1"); // 1º undo: reverte só a edição mais recente
    r = desfazer(h, "vivo");
    h = r.h;
    expect(r.estado).toBe("s0"); // 2º undo: chega ao início
    r = desfazer(h, "vivo"); // 3º undo: já no índice 0, nada a fazer
    expect(r.estado).toBeNull();
  });

  test("undo em pilha totalmente vazia não quebra", () => {
    const h = pilhaVazia();
    const r = desfazer(h, "vivo");
    expect(r.estado).toBeNull();
  });

  test("redo além do fim não faz nada (estado null)", () => {
    let h = pilhaVazia();
    h = empilhar(h, "s0");
    const r = refazer(h);
    expect(r.estado).toBeNull();
  });
});

describe("podeDesfazer / podeRefazer — habilitação dos botões", () => {
  test("extremos da pilha desabilitam os botões correspondentes", () => {
    let h: HistoricoStack = pilhaVazia();
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(false);

    h = empilhar(h, "s0");
    expect(podeDesfazer(h)).toBe(false); // só 1 entrada — nada antes dela
    h = empilhar(h, "s1");
    expect(podeDesfazer(h)).toBe(true);
    expect(podeRefazer(h)).toBe(false); // no topo, nada pra refazer

    const r = desfazer(h, "vivo");
    h = r.h;
    expect(podeRefazer(h)).toBe(true);
  });
});
