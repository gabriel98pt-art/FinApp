// A ponte entre o id (que fica gravado no lançamento e nunca muda) e o nome
// (que a pessoa renomeia à vontade).
//
// É esta separação que permitiu apagar a cascata de renomear — a que reescrevia
// o nome dentro de nove coleções de lançamento —, e é ela que se parte primeiro
// se alguém trocar um pelo outro sem reparar. A conversão de/para o formato do
// RTDB tem testes em `cfgService.test.ts`, que é onde ela é usada.

import { describe, expect, test } from "vitest";
import type { Instituicao } from "../types";
import { instituicao } from "../testes/instituicoes";
import {
  brutoDasInstituicoes,
  comMetodoAtualizado,
  debitoDaMesmaInstituicao,
  idDisponivel,
  idsUsados,
  localizarMetodo,
  nomeAtualDoMetodo,
  semMetodo,
} from "./instituicoes";

/** Uma instituição com dois métodos — o caso que a Fase C2 vai abrir e que já
 *  decide o formato do rótulo. */
const bancoComDois: Instituicao = {
  id: "Banco X",
  nome: "Banco X",
  metodos: [
    { id: "Banco X", tipo: "debito" },
    { id: "Banco X Crédito", tipo: "credito" },
  ],
};

describe("nomeAtualDoMetodo", () => {
  test("depois de um rename, o id antigo devolve o nome novo", () => {
    // O lançamento continua a apontar para "AB Gold (C)" — é isso que dispensa
    // migrar histórico nenhum. Quem mostra é que resolve.
    const cfg = { instituicoes: [instituicao("Gold Novo", "credito", { id: "AB Gold (C)" })] };
    expect(nomeAtualDoMetodo(cfg, "AB Gold (C)")).toBe("Gold Novo");
  });

  test("instituição com um método só diz o nome dela, sem sufixo de tipo", () => {
    // Toda conta migrada 1:1 está aqui. Pôr "Banco X · Débito" onde se lia
    // "Banco X" mudava a tela de toda a gente sem nada em troca.
    expect(nomeAtualDoMetodo({ instituicoes: [instituicao("Banco X")] }, "Banco X")).toBe(
      "Banco X",
    );
  });

  test("com dois métodos, o tipo desempata", () => {
    const cfg = { instituicoes: [bancoComDois] };
    expect(nomeAtualDoMetodo(cfg, "Banco X")).toBe("Banco X · Débito");
    expect(nomeAtualDoMetodo(cfg, "Banco X Crédito")).toBe("Banco X · Crédito");
  });

  test("nome de exibição escolhido à mão ganha aos dois", () => {
    const cfg = {
      instituicoes: [
        {
          ...bancoComDois,
          metodos: [{ id: "m1", tipo: "credito" as const, nomeExibicao: "O das compras" }],
        },
      ],
    };
    expect(nomeAtualDoMetodo(cfg, "m1")).toBe("O das compras");
  });

  test("id que já não existe devolve o próprio id", () => {
    // Um lançamento numa conta apagada continua a dizer o nome com que foi
    // feito — em branco seria pior do que desatualizado.
    expect(nomeAtualDoMetodo({ instituicoes: [] }, "Conta Apagada")).toBe("Conta Apagada");
  });
});

describe("localizarMetodo", () => {
  test("devolve o método e a instituição a que pertence", () => {
    const achado = localizarMetodo({ instituicoes: [bancoComDois] }, "Banco X Crédito");
    expect(achado?.instituicao.id).toBe("Banco X");
    expect(achado?.metodo.tipo).toBe("credito");
  });

  test("null quando não existe, em vez de rebentar em quem chama", () => {
    expect(localizarMetodo({ instituicoes: [bancoComDois] }, "Sumiu")).toBeNull();
  });
});

describe("debitoDaMesmaInstituicao", () => {
  test("acha o débito da mesma instituição do cartão de crédito", () => {
    expect(debitoDaMesmaInstituicao({ instituicoes: [bancoComDois] }, "Banco X Crédito")).toBe(
      "Banco X",
    );
  });

  test("null quando a instituição não tem débito — só o próprio cartão", () => {
    const soCredito: Instituicao = {
      id: "Cartão Solo",
      nome: "Cartão Solo",
      metodos: [{ id: "Cartão Solo", tipo: "credito" }],
    };
    expect(debitoDaMesmaInstituicao({ instituicoes: [soCredito] }, "Cartão Solo")).toBeNull();
  });

  test("null quando o método não existe", () => {
    expect(debitoDaMesmaInstituicao({ instituicoes: [bancoComDois] }, "Sumiu")).toBeNull();
  });
});

describe("ids", () => {
  test("idsUsados junta os das instituições e os dos métodos", () => {
    expect(idsUsados([bancoComDois])).toEqual(new Set(["Banco X", "Banco X Crédito"]));
  });

  test("idDisponivel usa o nome quando está livre", () => {
    expect(idDisponivel("Gold", new Set())).toBe("Gold");
  });

  test("idDisponivel desvia quando o nome já foi id de outra coisa", () => {
    // "Gold" foi renomeado e deixou o id para trás; um cartão novo com o mesmo
    // nome não pode herdar os lançamentos do antigo.
    expect(idDisponivel("Gold", new Set(["Gold"]))).toBe("Gold 2");
    expect(idDisponivel("Gold", new Set(["Gold", "Gold 2"]))).toBe("Gold 3");
  });
});

describe("mexer na lista", () => {
  test("comMetodoAtualizado troca só o método pedido", () => {
    const depois = comMetodoAtualizado([bancoComDois], "Banco X Crédito", (m) => ({
      ...m,
      diaVencimentoFatura: 8,
    }));
    expect(depois[0].metodos[0]).toEqual({ id: "Banco X", tipo: "debito" });
    expect(depois[0].metodos[1].diaVencimentoFatura).toBe(8);
  });

  test("semMetodo deixa cair a instituição que fica sem métodos", () => {
    expect(semMetodo([instituicao("Gold")], "Gold")).toEqual([]);
    // Com dois, a instituição fica — é o caso que a C2 abre.
    expect(semMetodo([bancoComDois], "Banco X")[0].metodos).toEqual([
      { id: "Banco X Crédito", tipo: "credito" },
    ]);
  });
});

describe("brutoDasInstituicoes", () => {
  test("indexa por id e não grava campos ausentes — o RTDB rejeita undefined", () => {
    const bruto = brutoDasInstituicoes([
      instituicao("Gold", "credito", { diaFechamentoFatura: 28 }),
    ]);
    expect(bruto).toEqual({
      Gold: { nome: "Gold", metodos: { Gold: { tipo: "credito", diaFechamentoFatura: 28 } } },
    });
  });

  test("dia fora de 1-31 não chega a ser gravado", () => {
    const bruto = brutoDasInstituicoes([
      instituicao("Gold", "credito", { diaVencimentoFatura: 0, diaFechamentoFatura: 45 }),
    ]);
    expect(bruto.Gold.metodos).toEqual({ Gold: { tipo: "credito" } });
  });
});
