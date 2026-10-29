// @vitest-environment jsdom

// "Número em destaque": uma escolha por página, que guarda em `kpiDestaque`.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../../constants/configPadrao";
import type { ConfigConta } from "../../types";

const atualizarConfig = vi.fn(async () => {});
vi.mock("../../services/cfgService", () => ({ atualizarConfig }));

const FolhaKpiDestaque = (await import("./FolhaKpiDestaque")).default;

function desenhar(cfg: ConfigConta = CONFIG_PADRAO) {
  return render(<FolhaKpiDestaque cfg={cfg} uid="u1" aberta aoFechar={() => {}} />);
}

const grupo = (nome: string) => screen.getByRole("radiogroup", { name: nome });

beforeEach(() => atualizarConfig.mockClear());

describe("FolhaKpiDestaque", () => {
  test("sem escolha, a primeira opção de cada página vem marcada", () => {
    desenhar();
    const radio = within(grupo("Despesas")).getByRole("radio", { name: "Total do mês" });
    expect(radio).toHaveAttribute("aria-checked", "true");
  });

  test("escolher grava só aquela página, sem apagar as outras", async () => {
    desenhar({ ...CONFIG_PADRAO, kpiDestaque: { receitas: "Maior fonte" } });
    await userEvent.click(
      within(grupo("Despesas")).getByRole("radio", { name: "Maior categoria" }),
    );
    expect(atualizarConfig).toHaveBeenCalledWith("u1", {
      kpiDestaque: { receitas: "Maior fonte", despesas: "Maior categoria" },
    });
  });

  test("mostra a escolha guardada como marcada", () => {
    desenhar({ ...CONFIG_PADRAO, kpiDestaque: { despesas: "vs mês passado" } });
    const radios = within(grupo("Despesas")).getAllByRole("radio");
    expect(radios.filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(
      within(grupo("Despesas")).getByRole("radio", { name: "vs mês passado" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("a antiga escolha de 2 KPIs dá o padrão: o primeiro dela", () => {
    desenhar({
      ...CONFIG_PADRAO,
      kpisMobile: { despesas: ["Média (3 meses)", "Maior categoria"] },
    });
    expect(
      within(grupo("Despesas")).getByRole("radio", { name: "Média (3 meses)" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("o Início já não aparece: já não tem KPIs", () => {
    desenhar();
    expect(screen.queryByRole("radiogroup", { name: "Início" })).not.toBeInTheDocument();
  });

  test("uma escolha antiga de Cartões fica inerte e nada parte", () => {
    desenhar({ ...CONFIG_PADRAO, kpiDestaque: { cartoes: "Pago", parcelas: "Falta pagar" } });
    expect(grupo("Despesas")).toBeInTheDocument();
  });

  test("Cartões, Transações e Parcelas já não têm KPIs para escolher", () => {
    desenhar();
    for (const nome of ["Cartões", "Transações", "Parcelas"]) {
      expect(screen.queryByRole("radiogroup", { name: nome })).toBeNull();
    }
  });
});
