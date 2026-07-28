import { describe, expect, test } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta } from "../types";
import {
  DADOS_RENOMEAR_VAZIOS,
  patchRenomearCartao,
  patchRenomearCategoria,
  patchRenomearFonte,
  patchRenomearLocal,
  validarNomeNovo,
  type DadosRenomear,
} from "./renomear";

const VELHO = "AB Gold (C)";
const NOVO = "Gold Novo";

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

describe("renomear conta/cartão", () => {
  const cfg = cfgCom({
    contasCartoes: ["Conta Principal", VELHO],
    tipoCartao: { "Conta Principal": "debit", [VELHO]: "credit" },
    saldosIniciais: { [VELHO]: 15000 },
    faturaManual: { [VELHO]: { "2026-07": 9900 } },
    faturasPagas: {
      [VELHO]: { "2026-06": { pagamentos: [{ id: "pg1", data: "2026-06-05", valor: 5000 }] } },
    },
  });

  const dados: DadosRenomear = {
    ...DADOS_RENOMEAR_VAZIOS,
    receitas: [
      {
        id: "r1",
        descricao: "Salário",
        valor: 200000,
        data: "2026-06-01",
        fonte: "Trabalho",
        conta: VELHO,
      },
      {
        id: "r2",
        descricao: "Extra",
        valor: 5000,
        data: "2026-06-02",
        fonte: "Trabalho",
        conta: "Conta Principal",
      },
    ],
    despesas: [
      {
        id: "d1",
        descricao: "Mercado",
        valor: 4200,
        data: "2026-06-03",
        categoria: "Alimentação",
        contaCartao: VELHO,
      },
      { id: "d2", descricao: "Café", valor: 200, data: "2026-06-04", categoria: "Alimentação" },
    ],
    despesasFixas: [
      {
        id: "f1",
        descricao: "Netflix",
        valor: 1500,
        categoria: "Assinaturas",
        contaCartao: VELHO,
        pagoPorMes: {},
      },
    ],
    fixasVeiculo: [
      {
        id: "fv1",
        descricao: "Seguro",
        valor: 4500,
        categoria: "Veículo",
        contaCartao: VELHO,
        pagoPorMes: {},
      },
    ],
    transferencias: [
      { id: "t1", data: "2026-06-05", de: VELHO, para: "Conta Principal", valor: 3000 },
      { id: "t2", data: "2026-06-06", de: "Conta Principal", para: VELHO, valor: 1000 },
    ],
    parcelas: [
      {
        id: "p1",
        descricao: "Telemóvel",
        total: 30000,
        numParcelas: 10,
        primeiroMes: "2026-01",
        categoria: "Compras",
        cartao: VELHO,
        autoDebit: true,
        pagoPorMes: {},
      },
    ],
    cargas: [
      {
        id: "c1",
        data: "2026-06-07",
        kwh: 30,
        precoKwh: 25,
        custo: 750,
        local: "Casa",
        contaCartao: VELHO,
      },
    ],
    despesasVeiculo: [
      { id: "dv1", data: "2026-06-08", valor: 8900, categoria: "Manutenção", contaCartao: VELHO },
    ],
  };

  const patch = patchRenomearCartao(cfg, dados, VELHO, NOVO);

  test("troca o nome na lista sem mexer na ordem nem nos outros", () => {
    expect(patch["cfg/contasCartoes"]).toEqual(["Conta Principal", NOVO]);
  });

  test("move as 4 chaves de cfg indexadas pelo cartão e apaga as antigas", () => {
    expect(patch[`cfg/tipoCartao/${NOVO}`]).toBe("credit");
    expect(patch[`cfg/tipoCartao/${VELHO}`]).toBeNull();
    expect(patch[`cfg/saldosIniciais/${NOVO}`]).toBe(15000);
    expect(patch[`cfg/saldosIniciais/${VELHO}`]).toBeNull();
    expect(patch[`cfg/faturaManual/${NOVO}`]).toEqual({ "2026-07": 9900 });
    expect(patch[`cfg/faturaManual/${VELHO}`]).toBeNull();
    expect(patch[`cfg/faturasPagas/${NOVO}`]).toEqual(cfg.faturasPagas[VELHO]);
    expect(patch[`cfg/faturasPagas/${VELHO}`]).toBeNull();
    // a conta que não foi renomeada continua intocada
    expect(patch["cfg/tipoCartao/Conta Principal"]).toBeUndefined();
  });

  test("cada lançamento que apontava pro cartão passa a apontar pro nome novo", () => {
    expect(patch["receitas/r1/conta"]).toBe(NOVO);
    expect(patch["despesasCorrentes/d1/contaCartao"]).toBe(NOVO);
    expect(patch["despesasFixas/f1/contaCartao"]).toBe(NOVO);
    expect(patch["veiculo/despesasFixas/fv1/contaCartao"]).toBe(NOVO);
    expect(patch["transferencias/t1/de"]).toBe(NOVO);
    expect(patch["transferencias/t2/para"]).toBe(NOVO);
    expect(patch["parcelas/p1/cartao"]).toBe(NOVO);
    expect(patch["veiculo/cargas/c1/contaCartao"]).toBe(NOVO);
    expect(patch["veiculo/despesas/dv1/contaCartao"]).toBe(NOVO);
  });

  test("não toca em quem apontava pra outra conta ou pra nenhuma", () => {
    expect(patch["receitas/r2/conta"]).toBeUndefined();
    expect(patch["despesasCorrentes/d2/contaCartao"]).toBeUndefined();
    expect(patch["transferencias/t1/para"]).toBeUndefined();
    expect(patch["transferencias/t2/de"]).toBeUndefined();
  });

  test("nada fica apontando pro nome antigo", () => {
    nadaOrfao(patch, VELHO);
  });
});

describe("renomear categoria", () => {
  const cfg = cfgCom({
    categoriasCorrentes: ["Alimentação", "Transporte"],
    categoriasFixas: ["Alimentação"],
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

  const patch = patchRenomearCategoria(cfg, dados, "categoriasCorrentes", "Alimentação", "Comida");

  test("troca só na lista escolhida — a lista de fixas com o mesmo nome não muda", () => {
    expect(patch["cfg/categoriasCorrentes"]).toEqual(["Comida", "Transporte"]);
    expect(patch["cfg/categoriasFixas"]).toBeUndefined();
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
