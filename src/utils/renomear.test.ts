import { describe, expect, test } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";
import {
  DADOS_RENOMEAR_VAZIOS,
  patchRenomearCategoria,
  patchRenomearFonte,
  patchRenomearLocal,
  validarNomeNovo,
  type DadosRenomear,
} from "./renomear";

function cfgCom(extra: Partial<ConfigConta>): ConfigConta {
  return { ...CONFIG_PADRAO, ...extra };
}

/** Nenhum caminho do patch pode continuar a apontar pro nome antigo — a não
 *  ser pra apagá-lo (valor `null`). É esta a garantia de "nada fica órfão". */
function nadaOrfao(patch: Record<string, unknown>, antigo: string) {
  for (const [caminho, valor] of Object.entries(patch)) {
    if (valor === null) continue;
    expect(caminho.endsWith(`/${antigo}`), `caminho ${caminho} ainda usa o nome antigo`).toBe(
      false,
    );
    expect(valor).not.toBe(antigo);
    if (Array.isArray(valor)) expect(valor).not.toContain(antigo);
  }
}

describe("validarNomeNovo", () => {
  test("recusa vazio, igual ao atual e duplicado na mesma lista", () => {
    expect(() => validarNomeNovo(["A", "B"], "A", "  ")).toThrow("Nome vazio.");
    expect(() => validarNomeNovo(["A", "B"], "A", "A")).toThrow("O nome é o mesmo.");
    expect(() => validarNomeNovo(["A", "B"], "A", "B")).toThrow("Já existe");
  });

  test("recusa caractere que o Realtime Database não aceita numa chave", () => {
    for (const mau of ["A.B", "A#B", "A$B", "A[B", "A]B", "A/B"]) {
      expect(() => validarNomeNovo(["A"], "A", mau), mau).toThrow("não pode ter");
    }
    // parênteses são comuns nos nomes de cartão ("AB Gold (C)") e continuam OK
    expect(validarNomeNovo(["A"], "A", "AB Gold (C)")).toBe("AB Gold (C)");
  });

  test("aceita nome novo e tira os espaços das pontas", () => {
    expect(validarNomeNovo(["A", "B"], "A", "  C  ")).toBe("C");
  });
});

describe("renomear categoria", () => {
  const cfg = cfgCom({
    categoriasDespesa: ["Alimentação", "Transporte"],
    categoriaIcone: { Alimentação: "utensils" },
    categoriaCor: { Alimentação: "#ff0000" },
    orcamentos: { Alimentação: 30000 },
  });

  const dados: DadosRenomear = {
    ...DADOS_RENOMEAR_VAZIOS,
    despesas: [
      { id: "d1", descricao: "Mercado", valor: 4200, data: "2026-06-03", categoria: "Alimentação" },
      { id: "d2", descricao: "Metro", valor: 150, data: "2026-06-03", categoria: "Transporte" },
    ],
    despesasFixas: [
      { id: "f1", descricao: "Cabaz", valor: 5000, categoria: "Alimentação", pagoPorMes: {} },
    ],
    parcelas: [
      {
        id: "p1",
        descricao: "Fogão",
        total: 60000,
        numParcelas: 6,
        primeiroMes: "2026-02",
        categoria: "Alimentação",
        cartao: null,
        autoDebit: false,
        pagoPorMes: {},
      },
    ],
  };

  const patch = patchRenomearCategoria(cfg, dados, "categoriasDespesa", "Alimentação", "Comida");

  test("troca na lista de categorias de despesa", () => {
    expect(patch["cfg/categoriasDespesa"]).toEqual(["Comida", "Transporte"]);
  });

  test("leva junto ícone, cor e orçamento", () => {
    expect(patch["cfg/categoriaIcone/Comida"]).toBe("utensils");
    expect(patch["cfg/categoriaIcone/Alimentação"]).toBeNull();
    expect(patch["cfg/categoriaCor/Comida"]).toBe("#ff0000");
    expect(patch["cfg/categoriaCor/Alimentação"]).toBeNull();
    expect(patch["cfg/orcamentos/Comida"]).toBe(30000);
    expect(patch["cfg/orcamentos/Alimentação"]).toBeNull();
  });

  test("uma parcela e uma despesa antigas passam a apontar pro nome novo", () => {
    expect(patch["parcelas/p1/categoria"]).toBe("Comida");
    expect(patch["despesasCorrentes/d1/categoria"]).toBe("Comida");
    expect(patch["despesasFixas/f1/categoria"]).toBe("Comida");
    expect(patch["despesasCorrentes/d2/categoria"]).toBeUndefined();
  });

  test("nada fica apontando pro nome antigo", () => {
    nadaOrfao(patch, "Alimentação");
  });

  test("categoria do veículo usa a sua própria lista e alcança as despesas do veículo", () => {
    const cfgV = cfgCom({
      categoriasVeiculo: ["Manutenção", "Portagens"],
      categoriaIcone: { Manutenção: "wrench" },
    });
    const dadosV: DadosRenomear = {
      ...DADOS_RENOMEAR_VAZIOS,
      despesasVeiculo: [
        { id: "dv1", data: "2026-06-08", valor: 8900, categoria: "Manutenção" },
        { id: "dv2", data: "2026-06-09", valor: 200, categoria: "Portagens" },
      ],
      fixasVeiculo: [
        { id: "fv1", descricao: "Revisão", valor: 12000, categoria: "Manutenção", pagoPorMes: {} },
      ],
    };
    const p = patchRenomearCategoria(cfgV, dadosV, "categoriasVeiculo", "Manutenção", "Oficina");
    expect(p["cfg/categoriasVeiculo"]).toEqual(["Oficina", "Portagens"]);
    expect(p["cfg/categoriaIcone/Oficina"]).toBe("wrench");
    expect(p["veiculo/despesas/dv1/categoria"]).toBe("Oficina");
    expect(p["veiculo/despesasFixas/fv1/categoria"]).toBe("Oficina");
    expect(p["veiculo/despesas/dv2/categoria"]).toBeUndefined();
    nadaOrfao(p, "Manutenção");
  });
});

describe("renomear fonte de receita", () => {
  const cfg = cfgCom({
    fontesReceita: ["Trabalho", "Extras"],
    categoriaIcone: { Trabalho: "briefcase" },
    categoriaCor: { Trabalho: "#00ff00" },
  });
  const dados: DadosRenomear = {
    ...DADOS_RENOMEAR_VAZIOS,
    receitas: [
      { id: "r1", descricao: "Salário", valor: 200000, data: "2026-06-01", fonte: "Trabalho" },
      { id: "r2", descricao: "Bico", valor: 5000, data: "2026-06-02", fonte: "Extras" },
    ],
  };
  const patch = patchRenomearFonte(cfg, dados, "Trabalho", "Emprego");

  test("troca a lista, o visual e a fonte das receitas", () => {
    expect(patch["cfg/fontesReceita"]).toEqual(["Emprego", "Extras"]);
    expect(patch["cfg/categoriaIcone/Emprego"]).toBe("briefcase");
    expect(patch["cfg/categoriaCor/Emprego"]).toBe("#00ff00");
    expect(patch["receitas/r1/fonte"]).toBe("Emprego");
    expect(patch["receitas/r2/fonte"]).toBeUndefined();
    nadaOrfao(patch, "Trabalho");
  });
});

describe("renomear local de carregamento", () => {
  const cfg = cfgCom({ locaisCarregamento: ["Casa", "Trabalho"] });
  const dados: DadosRenomear = {
    ...DADOS_RENOMEAR_VAZIOS,
    cargas: [
      { id: "c1", data: "2026-06-07", kwh: 30, precoKwh: 25, custo: 750, local: "Casa" },
      { id: "c2", data: "2026-06-08", kwh: 10, precoKwh: 25, custo: 250, local: "Trabalho" },
    ],
  };
  const patch = patchRenomearLocal(cfg, dados, "Casa", "Garagem");

  test("troca a lista e o local das cargas antigas", () => {
    expect(patch["cfg/locaisCarregamento"]).toEqual(["Garagem", "Trabalho"]);
    expect(patch["veiculo/cargas/c1/local"]).toBe("Garagem");
    expect(patch["veiculo/cargas/c2/local"]).toBeUndefined();
    nadaOrfao(patch, "Casa");
  });
});
