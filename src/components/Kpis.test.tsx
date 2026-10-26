// @vitest-environment jsdom

// O quadro de resumo: o KPI em destaque grande e os outros em colunas pequenas.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";

let cfg: ConfigConta = CONFIG_PADRAO;
vi.mock("../stores/cfgStore", () => ({
  useCfgStore: (s: (e: unknown) => unknown) => s({ cfg }),
}));

const { Kpis } = await import("./Pagina");
const KpiCard = (await import("./KpiCard")).default;

const quadro = (pagina?: string, extra?: React.ReactNode) =>
  render(
    <Kpis pagina={pagina}>
      <KpiCard rotulo="Total do mês" valor="€ 1.895,38" sub="Inclui fixas" />
      <KpiCard rotulo="Maior categoria" valor="Contas" sub="€ 701,00" tom="vermelho" />
      <KpiCard rotulo="vs mês passado" valor="+12%" tom="vermelho" />
      <KpiCard rotulo="Média (3 meses)" valor="€ 1.692,00" />
      {extra}
    </Kpis>,
  );

beforeEach(() => {
  cfg = CONFIG_PADRAO;
});

describe("Kpis — quadro de resumo", () => {
  test("mostra TODOS os KPIs de uma vez, sem cortar para 2", () => {
    quadro("despesas");
    for (const r of ["Total do mês", "Maior categoria", "vs mês passado", "Média (3 meses)"]) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
  });

  test("é um quadro só, com o rótulo do destaque como título", () => {
    quadro("despesas");
    const q = screen.getByRole("region", { name: "Total do mês" });
    expect(within(q).getByText("Maior categoria")).toBeInTheDocument();
  });

  test("página sem escolha: o primeiro KPI vai grande", () => {
    quadro("despesas");
    expect(screen.getByRole("img", { name: "€ 1.895,38" })).toBeInTheDocument();
    // Os outros são colunas pequenas, não números grandes.
    expect(screen.queryByRole("img", { name: "€ 1.692,00" })).not.toBeInTheDocument();
    expect(screen.getByText("€ 1.692,00")).toBeInTheDocument();
  });

  test("a escolha guardada decide qual vai grande", () => {
    cfg = { ...CONFIG_PADRAO, kpiDestaque: { despesas: "Média (3 meses)" } };
    quadro("despesas");
    expect(screen.getByRole("region", { name: "Média (3 meses)" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "€ 1.692,00" })).toBeInTheDocument();
    // E o que era o primeiro desce para coluna pequena.
    expect(screen.getByText("€ 1.895,38")).toBeInTheDocument();
  });

  test("quem só tinha a escolha antiga de 2 KPIs fica com o primeiro dela em destaque", () => {
    cfg = { ...CONFIG_PADRAO, kpisMobile: { despesas: ["Maior categoria", "vs mês passado"] } };
    quadro("despesas");
    expect(screen.getByRole("region", { name: "Maior categoria" })).toBeInTheDocument();
  });

  test("o KPI cujo valor é um nome também cabe no destaque, com o detalhe por baixo", () => {
    cfg = { ...CONFIG_PADRAO, kpiDestaque: { despesas: "Maior categoria" } };
    quadro("despesas");
    expect(screen.getByRole("img", { name: "Contas" })).toBeInTheDocument();
    expect(screen.getByText("€ 701,00")).toBeInTheDocument();
  });

  test("o tom vira cor só do valor", () => {
    quadro("despesas");
    const pequeno = screen.getByText("+12%").closest("div")!;
    expect(pequeno.style.getPropertyValue("--_cor")).toBe("var(--red)");
  });

  test("com mais de 3 pequenos, o resto desce para uma segunda linha", () => {
    quadro("despesas", <KpiCard rotulo="Extra" valor="1" />);
    // 5 KPIs: 1 grande + 4 pequenos → 3 + 1.
    const q = screen.getByRole("region", { name: "Total do mês" });
    expect(q.querySelectorAll("[class*='colunas']")).toHaveLength(2);
  });

  test("KPI clicável em destaque continua a ser um botão com o rótulo no nome", async () => {
    const aoClicar = vi.fn();
    render(
      <Kpis pagina="planejamento">
        <KpiCard rotulo="Total" valor="€ 1.000,00" aoClicar={aoClicar} />
        <KpiCard rotulo="Restam" valor="€ 750,00" />
      </Kpis>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Total: € 1.000,00" }));
    expect(aoClicar).toHaveBeenCalled();
  });

  test("KPI pequeno clicável é um botão", async () => {
    const aoClicar = vi.fn();
    render(
      <Kpis>
        <KpiCard rotulo="Total" valor="€ 1,00" />
        <KpiCard rotulo="Entradas" valor="€ 2,00" aoClicar={aoClicar} />
      </Kpis>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Entradas/ }));
    expect(aoClicar).toHaveBeenCalled();
  });

  test("modo discreto borra o valor, não o rótulo", () => {
    render(
      <Kpis>
        <KpiCard rotulo="Total" valor="€ 1,00" discreto />
        <KpiCard rotulo="Entradas" valor="€ 2,00" discreto />
      </Kpis>,
    );
    expect(screen.getByRole("img", { name: "€ 1,00" })).toHaveClass("discreto");
    expect(screen.getByText("€ 2,00")).toHaveClass("discreto");
    expect(screen.getByText("Entradas")).not.toHaveClass("discreto");
  });

  test("sem filhos não desenha nada", () => {
    const { container } = render(<Kpis pagina="despesas">{[]}</Kpis>);
    expect(container).toBeEmptyDOMElement();
  });
});
