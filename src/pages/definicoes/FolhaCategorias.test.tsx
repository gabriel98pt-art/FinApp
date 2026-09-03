// @vitest-environment jsdom

// "Adicionar" sozinho não diz o que se adiciona (achado do sweep de
// padronização, 03/09/2026) — esta folha serve duas listas diferentes
// (categorias de despesa e fontes de receita) com o mesmo componente, então
// o rótulo do botão tem de mudar com a lista.

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import FolhaCategorias from "./FolhaCategorias";

vi.mock("../../services/firebase", () => ({ db: {}, auth: {} }));
vi.mock("../../services/cfgService", () => ({
  adicionarItemLista: vi.fn(async () => {}),
  definirCorCategoria: vi.fn(async () => {}),
  definirIconeCategoria: vi.fn(async () => {}),
  removerItemLista: vi.fn(async () => {}),
  renomearCategoria: vi.fn(async () => {}),
  renomearFonte: vi.fn(async () => {}),
}));
vi.mock("../../hooks/useConfirmar", () => ({ useConfirmar: () => vi.fn(async () => true) }));

describe("FolhaCategorias — rótulo do botão de adicionar", () => {
  test("categorias de despesa: botão diz 'Adicionar categoria'", () => {
    render(
      <FolhaCategorias
        titulo="Categorias de despesa"
        itens={CONFIG_PADRAO.categoriasDespesa}
        lista="categoriasDespesa"
        cfg={CONFIG_PADRAO}
        uid="u1"
        aberta
        aoFechar={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Adicionar categoria" })).toBeInTheDocument();
  });

  test("fontes de receita: botão diz 'Adicionar fonte de receita'", () => {
    render(
      <FolhaCategorias
        titulo="Fontes de receita"
        itens={CONFIG_PADRAO.fontesReceita}
        lista="fontesReceita"
        cfg={CONFIG_PADRAO}
        uid="u1"
        aberta
        aoFechar={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Adicionar fonte de receita" })).toBeInTheDocument();
  });
});
