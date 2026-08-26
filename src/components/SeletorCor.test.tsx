// @vitest-environment jsdom

// O achado da auditoria: a personalização de cor do app oferecia a paleta
// inteira sem checar contraste — 12 a 14 das 24 cores reprovavam contra o
// fundo do app, chegando a deixar o :focus-visible global quase invisível.
// Este teste protege a defesa: quando `corDeFundo` é passado, uma cor que
// reprova fica visível na grade mas não é escolhível.

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SeletorCor from "./SeletorCor";

const FUNDO_ESCURO = "#101e30"; // --s1 do tema escuro

describe("SeletorCor", () => {
  test("sem corDeFundo, toda cor da grade é clicável (comportamento de sempre)", () => {
    const aoEscolher = vi.fn();
    render(<SeletorCor aberta aoFechar={vi.fn()} titulo="Cor" valor="" aoEscolher={aoEscolher} />);

    fireEvent.click(screen.getByRole("button", { name: "Cor #0f172a" }));
    expect(aoEscolher).toHaveBeenCalledWith("#0f172a");
  });

  test("com corDeFundo, uma cor que reprova contraste fica desabilitada", () => {
    const aoEscolher = vi.fn();
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor=""
        aoEscolher={aoEscolher}
        corDeFundo={[FUNDO_ESCURO]}
      />,
    );

    // #0f172a contra #101e30 é o caso real que motivou a validação.
    const botao = screen.getByRole("button", { name: "Cor #0f172a, contraste insuficiente" });
    expect(botao).toBeDisabled();

    fireEvent.click(botao);
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  test("com corDeFundo, uma cor que passa em todos os fundos continua clicável", () => {
    const aoEscolher = vi.fn();
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor=""
        aoEscolher={aoEscolher}
        corDeFundo={[FUNDO_ESCURO]}
      />,
    );

    // #06b6d4 (ciano vivo) contrasta bem contra o fundo escuro do app.
    const botao = screen.getByRole("button", { name: "Cor #06b6d4" });
    expect(botao).not.toBeDisabled();

    fireEvent.click(botao);
    expect(aoEscolher).toHaveBeenCalledWith("#06b6d4");
  });

  test("basta reprovar contra UM dos fundos passados pra ficar desabilitada", () => {
    const aoEscolher = vi.fn();
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor=""
        aoEscolher={aoEscolher}
        corDeFundo={["#ffffff", FUNDO_ESCURO]}
      />,
    );

    // #0f172a passa contra o fundo claro mas reprova contra o escuro — tem
    // que ficar desabilitada mesmo assim.
    expect(
      screen.getByRole("button", { name: "Cor #0f172a, contraste insuficiente" }),
    ).toBeDisabled();
  });

  test("coresEmUso marca (sem desabilitar) uma cor já usada por outra categoria", () => {
    const aoEscolher = vi.fn();
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor=""
        aoEscolher={aoEscolher}
        coresEmUso={["#06b6d4"]}
      />,
    );

    const botao = screen.getByRole("button", { name: "Cor #06b6d4, já usada por outra categoria" });
    expect(botao).not.toBeDisabled();

    fireEvent.click(botao);
    expect(aoEscolher).toHaveBeenCalledWith("#06b6d4");
  });

  test("a própria cor atual não é marcada como 'em uso por outra categoria'", () => {
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor="#06b6d4"
        aoEscolher={vi.fn()}
        coresEmUso={["#06b6d4"]}
      />,
    );

    // Aparece com o rótulo normal (é a cor ATIVA desta categoria) — o aviso
    // de "outra categoria" seria enganoso aqui.
    expect(screen.getByRole("button", { name: "Cor #06b6d4" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cor #06b6d4, já usada por outra categoria" }),
    ).toBeNull();
  });

  test('"Cor automática" nunca é afetada pela checagem de contraste', () => {
    const aoEscolher = vi.fn();
    render(
      <SeletorCor
        aberta
        aoFechar={vi.fn()}
        titulo="Cor"
        valor=""
        aoEscolher={aoEscolher}
        corDeFundo={[FUNDO_ESCURO]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cor automática" }));
    expect(aoEscolher).toHaveBeenCalledWith(null);
  });
});
