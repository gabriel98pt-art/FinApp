// Cor do botão de registro rápido conforme a página aberta.
//
// O que estes testes protegem: (1) o botão só se pinta nas quatro rotas que
// têm cor própria — em qualquer outra tem de devolver `undefined`, senão o
// azul padrão do CSS deixava de valer; (2) a escolha do utilizador em
// Definições continua a mandar sobre a cor semântica; e (3) o "+" acompanha o
// fundo. Este último é o que evita o botão invisível: quem escolher amarelo
// para "Despesa" e receber um "+" branco por cima fica com um botão em branco.

import { describe, expect, test } from "vitest";
import { estiloBotaoRegistro } from "./corBotaoRegistro";
import { corDaCategoriaVisual, corDoIconeSobre } from "./categoriaVisual";

const semCfg = undefined;

describe("estiloBotaoRegistro", () => {
  test("devolve undefined nas rotas sem cor própria", () => {
    // Sem estilo inline, o CSS fica com o `--blu` do app — que é o que se quer
    // em Início, Transações, Parcelas, Cartões, Metas, Definições…
    for (const rota of ["/", "/inicio", "/transacoes", "/parcelas", "/cartoes", "/definicoes"]) {
      expect(estiloBotaoRegistro(semCfg, rota)).toBeUndefined();
    }
  });

  test("pinta as quatro rotas que têm nome no mapa", () => {
    for (const rota of ["/despesas", "/receitas", "/veiculo", "/tvde"]) {
      const estilo = estiloBotaoRegistro(semCfg, rota);
      expect(estilo).toBeDefined();
      expect(estilo!.background).toMatch(/^#/);
    }
  });

  test("cada rota usa a cor da sua categoria homónima", () => {
    // A ligação é pelo nome: "/despesas" → "Despesa" no sistema de cores de
    // categoria. Se o mapa se desalinhasse, o botão pintava-se com a cor
    // errada sem nada falhar em lado nenhum.
    expect(estiloBotaoRegistro(semCfg, "/despesas")!.background).toBe(
      corDaCategoriaVisual(semCfg, "Despesa"),
    );
    expect(estiloBotaoRegistro(semCfg, "/receitas")!.background).toBe(
      corDaCategoriaVisual(semCfg, "Receita"),
    );
    expect(estiloBotaoRegistro(semCfg, "/veiculo")!.background).toBe(
      corDaCategoriaVisual(semCfg, "Veículo"),
    );
    expect(estiloBotaoRegistro(semCfg, "/tvde")!.background).toBe(
      corDaCategoriaVisual(semCfg, "TVDE"),
    );
  });

  test("Despesa e Receita não recebem a mesma cor", () => {
    // São os dois botões que o utilizador mais alterna. Se caíssem no mesmo
    // tom, a cor deixava de dizer em que tela se está — que é o objectivo
    // inteiro de pintar o botão.
    expect(estiloBotaoRegistro(semCfg, "/despesas")!.background).not.toBe(
      estiloBotaoRegistro(semCfg, "/receitas")!.background,
    );
  });

  test("a cor escolhida em Definições ganha à cor semântica", () => {
    const cfg = { categoriaIcone: {}, categoriaCor: { Despesa: "#ff00ff" } };
    expect(estiloBotaoRegistro(cfg, "/despesas")!.background).toBe("#ff00ff");
    // E não contamina as outras rotas.
    expect(estiloBotaoRegistro(cfg, "/receitas")!.background).not.toBe("#ff00ff");
  });

  test("o + fica escuro sobre fundo claro e claro sobre fundo escuro", () => {
    const claro = { categoriaIcone: {}, categoriaCor: { Despesa: "#ffee00" } };
    const escuro = { categoriaIcone: {}, categoriaCor: { Despesa: "#101010" } };

    const sobreClaro = estiloBotaoRegistro(claro, "/despesas")!;
    const sobreEscuro = estiloBotaoRegistro(escuro, "/despesas")!;

    expect(sobreClaro.color).toBe(corDoIconeSobre("#ffee00"));
    expect(sobreEscuro.color).toBe(corDoIconeSobre("#101010"));
    // O ponto todo: as duas não podem ser a mesma, senão uma delas some.
    expect(sobreClaro.color).not.toBe(sobreEscuro.color);
  });

  test("cfg sem a categoria escolhida cai na cor semântica, não rebenta", () => {
    const cfg = { categoriaIcone: {}, categoriaCor: { Alimentação: "#123456" } };
    expect(estiloBotaoRegistro(cfg, "/despesas")!.background).toBe(
      corDaCategoriaVisual(semCfg, "Despesa"),
    );
  });

  test("rota com querystring ou barra final não é reconhecida", () => {
    // Documenta o comportamento real: o mapa é por igualdade exacta de
    // pathname. O router da app nunca entrega estas formas, mas se um dia
    // entregar, isto falha aqui em vez de silenciosamente despintar o botão.
    expect(estiloBotaoRegistro(semCfg, "/despesas/")).toBeUndefined();
    expect(estiloBotaoRegistro(semCfg, "/despesas?mes=2026-08")).toBeUndefined();
  });
});
