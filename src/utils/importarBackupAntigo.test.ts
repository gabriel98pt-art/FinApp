import { describe, expect, test } from "vitest";
import type {
  CargaVeiculoAntiga,
  CfgAntiga,
  DespesaCorrenteAntiga,
  DespesaFixaAntiga,
  DespesaVeiculoAntiga,
  KmVeiculoAntiga,
  ParcelaAntiga,
  ReceitaAntiga,
  TransferenciaAntiga,
} from "../types";
import {
  mapearCfg,
  mapearCfgTvde,
  mapearDespesasCorrentes,
  mapearDespesasFixas,
  mapearDespesasVeiculo,
  mapearCargasVeiculo,
  mapearLancamentosTvde,
  mapearParcelas,
  mapearQuilometragem,
  mapearReceitas,
  mapearSegPorMesTvde,
  mapearSemanasTvde,
  mapearTransferencias,
  parseMesAnoPt,
  validarSchemaFinV4,
} from "./importarBackupAntigo";

describe("validarSchemaFinV4", () => {
  test("aceita _schema === 'fin_v4'", () => {
    expect(validarSchemaFinV4({ _schema: "fin_v4" })).toBe(true);
  });
  test("rejeita schema diferente ou ausente", () => {
    expect(validarSchemaFinV4({ _schema: "fin_v3" })).toBe(false);
    expect(validarSchemaFinV4({})).toBe(false);
    expect(validarSchemaFinV4(null)).toBe(false);
    expect(validarSchemaFinV4("fin_v4")).toBe(false);
  });
});

describe("mapearDespesasFixas — achado 1: paidMonths vs paid único", () => {
  test("paidMonths presente prevalece sobre paid (fixa já com histórico mês-a-mês)", () => {
    const df: DespesaFixaAntiga[] = [
      {
        id: 14,
        name: "Aluguel",
        val: 350,
        cat: "Aluguel",
        card: "ActivoBank",
        activeFrom: "2026-01",
        paid: true,
        paidMonths: {
          "2026-01": true,
          "2026-02": true,
          "2026-06": true,
          "2026-07": true,
        },
      },
    ];
    const r = mapearDespesasFixas(df, "2026-07");
    expect(r["14"].pagoPorMes).toEqual({
      "2026-01": true,
      "2026-02": true,
      "2026-06": true,
      "2026-07": true,
    });
  });

  test("sem paidMonths: paid:true vira UM único mês marcado (mesReferencia)", () => {
    const df: DespesaFixaAntiga[] = [
      { id: 10, name: "Seguro Saúde", val: 26.77, cat: "Saúde", card: "ActivoBank", paid: true },
    ];
    const r = mapearDespesasFixas(df, "2026-07");
    expect(r["10"].pagoPorMes).toEqual({ "2026-07": true });
    expect(r["10"].valor).toBe(2677);
  });

  test("paid:false ou ausente vira pagoPorMes vazio", () => {
    const df: DespesaFixaAntiga[] = [
      { id: 771, name: "Gigu", val: 5.9, cat: "Telemóvel", card: "Revolut", paid: false },
      { id: 1102, name: "plano ab premium", val: 9.35, cat: "Assinatura", card: "ActivoBank" },
    ];
    const r = mapearDespesasFixas(df, "2026-07");
    expect(r["771"].pagoPorMes).toEqual({});
    expect(r["1102"].pagoPorMes).toEqual({});
  });

  test("card vazio vira contaCartao undefined", () => {
    const df: DespesaFixaAntiga[] = [{ id: 1, name: "X", val: 10, cat: "Outros", card: "" }];
    expect(mapearDespesasFixas(df, "2026-07")["1"].contaCartao).toBeUndefined();
  });
});

describe("mapearDespesasCorrentes — achado 2: mirror do veículo excluído", () => {
  test("_src:'veh' COM _vid é excluído (já entra pelo domínio do veículo)", () => {
    const dc: DespesaCorrenteAntiga[] = [
      {
        id: 359,
        date: "2026-05-17",
        val: 13.36,
        cat: "Carga Elétrica",
        card: "AB Gold",
        _src: "veh",
        _vid: 358,
        _vtype: "carga",
      },
    ];
    expect(mapearDespesasCorrentes(dc)).toEqual({});
  });

  test("_src:'veh' SEM _vid é uma despesa de verdade — não é excluído", () => {
    const dc: DespesaCorrenteAntiga[] = [
      {
        id: 709,
        date: "2026-03-17",
        val: 23.25,
        cat: "Carga Elétrica",
        card: "",
        name: "COMPRA 1872 POWER DOT LISBOA PT",
        notes: "Importado",
        _src: "veh",
      },
    ];
    const r = mapearDespesasCorrentes(dc);
    expect(r["709"]).toBeDefined();
    expect(r["709"].origem).toBeUndefined();
    expect(r["709"].valor).toBe(2325);
  });

  test("origem 'parc'/'fat'/'recon' preservada, com parcelaId/parcelaMes e fatCartao/fatMes", () => {
    const dc: DespesaCorrenteAntiga[] = [
      {
        id: 330,
        date: "2026-05-20",
        val: 19.83,
        cat: "Parcelas",
        card: "",
        notes: "Hacoo — 1ª de 5",
        _src: "parc",
        _pid: 42,
        _pm: "2026-05",
      },
      {
        id: 388,
        date: "2026-05-20",
        val: 373.75,
        cat: "Fatura Cartão",
        card: "ActivoBank",
        name: "Fatura AB Gold (C)",
        notes: "Ref. Mai 2026",
        _src: "fat",
        _fatCard: "AB Gold (C)",
        _fatYm: "2026-05",
      },
    ];
    const r = mapearDespesasCorrentes(dc);
    expect(r["330"]).toMatchObject({
      origem: "parc",
      parcelaId: "42",
      parcelaMes: "2026-05",
      descricao: "Hacoo — 1ª de 5",
    });
    expect(r["388"]).toMatchObject({
      origem: "fat",
      fatCartao: "AB Gold (C)",
      fatMes: "2026-05",
      descricao: "Fatura AB Gold (C)",
    });
  });

  test("descrição: name > notes > cat, o primeiro preenchido", () => {
    const semName: DespesaCorrenteAntiga = {
      id: 1,
      date: "2026-01-01",
      val: 10,
      cat: "Contas de Casa",
      notes: "57,30",
    };
    const comName: DespesaCorrenteAntiga = {
      id: 2,
      date: "2026-01-01",
      val: 10,
      cat: "Lazer",
      name: "Barbeiro",
      notes: "",
    };
    const r = mapearDespesasCorrentes([semName, comName]);
    expect(r["1"].descricao).toBe("57,30");
    expect(r["2"].descricao).toBe("Barbeiro");
  });
});

describe("mapearParcelas", () => {
  test("total ausente é derivado de vp × num", () => {
    const par: ParcelaAntiga[] = [
      {
        id: 44,
        name: "Impress",
        vp: 182.03,
        cat: "Saúde",
        card: "Revolut",
        num: 8,
        fd: "2026-04-26",
      },
    ];
    const r = mapearParcelas(par);
    expect(r["44"].total).toBe(Math.round(182.03 * 100) * 8);
    expect(r["44"].primeiroMes).toBe("2026-04");
  });

  test("total presente é respeitado (não recalculado)", () => {
    const par: ParcelaAntiga[] = [
      {
        id: 34,
        name: "Empréstimo 2",
        vp: 93.93,
        cat: "Empréstimo",
        card: "ActivoBank",
        num: 15,
        fd: "2026-04-14",
        total: 1408.95,
        autoDebit: false,
      },
    ];
    expect(mapearParcelas(par)["34"].total).toBe(140895);
  });

  test("py copiado direto para pagoPorMes", () => {
    const par: ParcelaAntiga[] = [
      {
        id: 1,
        name: "X",
        vp: 10,
        num: 2,
        fd: "2026-01-01",
        py: { "2026-01": true, "2026-02": true },
      },
    ];
    expect(mapearParcelas(par)["1"].pagoPorMes).toEqual({ "2026-01": true, "2026-02": true });
  });
});

describe("mapearReceitas / mapearTransferencias", () => {
  test("descricao: notes > src", () => {
    const rec: ReceitaAntiga[] = [
      { id: 1, date: "2026-05-04", val: 440.88, src: "Vencimento", notes: "" },
      { id: 2, date: "2026-05-20", val: 67.98, src: "Transferência", notes: "wise" },
    ];
    const r = mapearReceitas(rec);
    expect(r["1"].descricao).toBe("Vencimento");
    expect(r["1"].fonte).toBe("Vencimento");
    expect(r["2"].descricao).toBe("wise");
    expect(r["2"].fonte).toBe("Transferência");
  });

  test("transferências mapeiam de/para/valor/descricao direto", () => {
    const trf: TransferenciaAntiga[] = [
      { id: 760, date: "2026-05-23", from: "ActivoBank", to: "Revolut", val: 275.85, notes: "" },
    ];
    const r = mapearTransferencias(trf);
    expect(r["760"]).toEqual({
      data: "2026-05-23",
      de: "ActivoBank",
      para: "Revolut",
      valor: 27585,
      descricao: undefined,
    });
  });
});

describe("mapearCargasVeiculo / mapearQuilometragem / mapearDespesasVeiculo (veh.lp)", () => {
  test("preco presente vira precoKwh direto (toCents)", () => {
    const cg: CargaVeiculoAntiga[] = [
      { id: 1124, date: "2026-06-10", val: 11.97, kwh: 29.195, preco: 0.41 },
    ];
    expect(mapearCargasVeiculo(cg)["1124"].precoKwh).toBe(41);
  });

  test("preco ausente é derivado de custo/kwh", () => {
    const cg: CargaVeiculoAntiga[] = [
      { id: 358, date: "2026-05-17", val: 13.36, kwh: 32.9, local: "powerdot alameda" },
    ];
    const r = mapearCargasVeiculo(cg)["358"];
    expect(r.custo).toBe(1336);
    expect(r.precoKwh).toBe(Math.round(1336 / 32.9));
  });

  test("kwh ausente vira 0, sem dividir por zero", () => {
    const cg: CargaVeiculoAntiga[] = [
      { id: 709, date: "2026-03-17", val: 23.25, local: "COMPRA 1872 POWER DOT LISBOA PT" },
    ];
    const r = mapearCargasVeiculo(cg)["709"];
    expect(r.kwh).toBe(0);
    expect(r.precoKwh).toBe(0);
  });

  test("quilometragem deriva a data de weekTo (sem campo de data direto)", () => {
    const km: KmVeiculoAntiga[] = [
      { id: 1113, km: 850, weekFrom: "2026-06-15", weekTo: "2026-06-21" },
    ];
    expect(mapearQuilometragem(km)["1113"].data).toBe("2026-06-21");
  });

  test("achado 2b: veh.lp usa o campo `tipo`, não `cat`, como categoria", () => {
    const lp: DespesaVeiculoAntiga[] = [
      { id: 386, date: "2026-05-14", val: 5, tipo: "Limpeza" },
      { id: 1093, date: "2026-06-16", val: 9.5, tipo: "Manutenção" },
    ];
    const r = mapearDespesasVeiculo(lp);
    expect(r["386"].categoria).toBe("Limpeza");
    expect(r["1093"].categoria).toBe("Manutenção");
    expect(r["386"].valor).toBe(500);
  });
});

describe("TVDE — achado 3: seg (período) ignorado, segM (mês) migrado, metaHoras/metaHora não têm destino", () => {
  test("parseMesAnoPt converte 'Mês Ano' em português para AAAA-MM", () => {
    expect(parseMesAnoPt("Março 2026")).toBe("2026-03");
    expect(parseMesAnoPt("Abril 2026")).toBe("2026-04");
    expect(parseMesAnoPt("Dezembro 2025")).toBe("2025-12");
    expect(parseMesAnoPt("lixo")).toBeNull();
  });

  test("mapearSegPorMesTvde usa só segM, nunca lê tvde.seg", () => {
    // tvde.seg (por período 1/2/3/4) nem é aceito como parâmetro — a própria
    // assinatura da função só recebe segM, então não há como misturá-los.
    const segM = { Março: NaN }; // formato inválido de propósito
    expect(mapearSegPorMesTvde(segM as unknown as Record<string, number>)).toEqual({});

    const segMValido = { "Março 2026": 136.44, "Junho 2026": 132.66 };
    expect(mapearSegPorMesTvde(segMValido)).toEqual({ "2026-03": 13644, "2026-06": 13266 });
  });

  test("mapearCfgTvde migra só pctFrota/aluguel/metaSem/metaMes — metaHoras/metaHora ficam de fora", () => {
    const cfgAntigo = {
      pctFrota: 6,
      aluguel: 260,
      metaSem: 320,
      metaMes: 1300,
      metaHoras: 45,
      metaHora: 6.5,
    };
    const r = mapearCfgTvde(cfgAntigo as never);
    expect(r).toEqual({ pctFrota: 6, aluguel: 26000, metaSem: 32000, metaMes: 130000 });
    expect(r).not.toHaveProperty("metaHoras");
    expect(r).not.toHaveProperty("metaHora");
  });

  test("mapearSemanasTvde converte os campos monetários para centavos, mantém horas/viag/pct", () => {
    const r = mapearSemanasTvde({
      "2": {
        alu: 260,
        extra: 0,
        fat: 684.58,
        gorj: 3.5,
        horas: 50,
        pct: 6,
        port: 3.3,
        recF: 0,
        recP: 58.5,
        viag: 137,
      },
    });
    expect(r["2"]).toEqual({
      alu: 26000,
      extra: 0,
      fat: 68458,
      gorj: 350,
      horas: 50,
      pct: 6,
      port: 330,
      recF: 0,
      recP: 5850,
      viag: 137,
    });
  });

  test("mapearLancamentosTvde só migra a marcação se o rid existir nas receitas importadas", () => {
    const lanc = { w19: { rid: 1196, val: 346, at: 123 } };
    // rid 1196 NÃO existe entre as receitas (achado real do arquivo de referência)
    expect(mapearLancamentosTvde(lanc, new Set(["1", "2"]))).toEqual({});
    // se existisse, migraria só a marcação semana→id, sem recriar a receita
    expect(mapearLancamentosTvde(lanc, new Set(["1196"]))).toEqual({ "19": "1196" });
  });
});

describe("mapearCfg", () => {
  test("mapeia moeda, categorias, orçamento, saldo inicial, cartões e locais", () => {
    const cfg: CfgAntiga = {
      currency: "EUR",
      theme: "dark",
      showTvde: true,
      ccat: ["Mercado", "Restaurante"],
      fcat: ["Aluguel", "Saúde"],
      vcat: ["Limpeza"],
      src: ["Vencimento"],
      pay: ["Revolut", "ActivoBank"],
      cardType: { "AB Gold": "credit", ActivoBank: "debit", Wise: "transit" },
      sgoal: 250,
      bud: { Mercado: 300, Lazer: 0 },
      bal: { "AB (D)": 0, "Revolut (D)": 12.5 },
      locais: [{ nome: "Continente" }, { nome: "" }],
    };
    const r = mapearCfg(cfg);
    expect(r.currency).toBe("EUR");
    expect(r.theme).toBe("dark");
    expect(r.showTvde).toBe(true);
    expect(r.categoriasCorrentes).toEqual(["Mercado", "Restaurante"]);
    expect(r.categoriasFixas).toEqual(["Aluguel", "Saúde"]);
    expect(r.categoriasVeiculo).toEqual(["Limpeza"]);
    expect(r.fontesReceita).toEqual(["Vencimento"]);
    expect(r.contasCartoes).toEqual(["Revolut", "ActivoBank"]);
    // "transit" não existe no tipo novo — cai em débito (não entra na fatura)
    expect(r.tipoCartao).toEqual({ "AB Gold": "credit", ActivoBank: "debit", Wise: "debit" });
    expect(r.metaPoupanca).toBe(25000);
    // orçamento 0 é "sem teto" — não vira uma entrada de 0
    expect(r.orcamentos).toEqual({ Mercado: 30000 });
    expect(r.saldosIniciais).toEqual({ "AB (D)": 0, "Revolut (D)": 1250 });
    expect(r.locaisCarregamento).toEqual(["Continente"]);
  });

  test("fatManual converte euros→centavos; fatPaid reaproveita o parser legado de pagamentosDaFatura", () => {
    const cfg: CfgAntiga = {
      fatManual: { "AB Gold": { "2026-06": 488.94 } },
      fatPaid: {
        "AB Gold": {
          "2026-05": { date: "2026-05-20", dcId: 388, from: "AB (D)", paid: true, val: 373.75 },
          "2026-07": {
            paid: false,
            payments: [{ date: "2026-07-15", dcId: 1226, from: "ActivoBank", val: 220 }],
          },
        },
      },
    };
    const r = mapearCfg(cfg);
    expect(r.faturaManual).toEqual({ "AB Gold": { "2026-06": 48894 } });
    expect(r.faturasPagas!["AB Gold"]["2026-05"]).toEqual({
      pagamentos: [{ id: "388", data: "2026-05-20", valor: 37375, de: "AB (D)" }],
    });
    expect(r.faturasPagas!["AB Gold"]["2026-07"]).toEqual({
      pagamentos: [{ id: "1226", data: "2026-07-15", valor: 22000, de: "ActivoBank" }],
    });
  });
});
