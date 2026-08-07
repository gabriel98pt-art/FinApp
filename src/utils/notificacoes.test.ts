import { describe, expect, test } from "vitest";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ConfigConta, DespesaFixa, Parcela } from "../types";
import type { DadosFatura } from "./fatura";
import {
  notificacoesDeFaturas,
  notificacoesDeFixas,
  notificacoesDeParcelas,
  todasNotificacoes,
} from "./notificacoes";

const MES = "2026-08";
const HOJE = "2026-08-20";
const CARTAO = "AB Gold (C)";

const cfg: ConfigConta = {
  ...CONFIG_PADRAO,
  contasCartoes: [CARTAO, "Conta"],
  tipoCartao: { [CARTAO]: "credit", Conta: "debit" },
};

const semDados: DadosFatura = {
  despesasFixas: [],
  despesasFixasVeiculo: [],
  despesasCorrentes: [],
  parcelas: [],
  transferencias: [],
};

function parcela(extra: Partial<Parcela> = {}): Parcela {
  return {
    id: "p1",
    descricao: "Sofá",
    total: 60000,
    numParcelas: 6,
    primeiroMes: "2026-06",
    categoria: "Compras",
    pagoPorMes: {},
    ...extra,
  };
}

function fixa(extra: Partial<DespesaFixa> = {}): DespesaFixa {
  return {
    id: "f1",
    descricao: "Renda",
    valor: 50000,
    categoria: "Casa",
    pagoPorMes: {},
    ...extra,
  };
}

describe("notificacoesDeParcelas", () => {
  // Paga até julho: o mês em aberto é agosto, o corrente.
  const ateJulho = { "2026-06": true, "2026-07": true } as const;

  test("dia já passado entra, com os dias de atraso certos", () => {
    const p = parcela({ diaVencimento: 10, pagoPorMes: { ...ateJulho } });
    const n = notificacoesDeParcelas([p], HOJE, MES);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ id: "parcela-p1", tipo: "parcela", dia: "2026-08-10" });
    expect(n[0].diasAtraso).toBe(10);
  });

  test("dia ainda por vir não entra", () => {
    const p = parcela({ diaVencimento: 28, pagoPorMes: { ...ateJulho } });
    expect(notificacoesDeParcelas([p], HOJE, MES)).toHaveLength(0);
  });

  // Uma linha só, a do mês em aberto mais antigo — calar o atraso antigo
  // esconderia justamente a pendência mais grave.
  test("parcela atrasada de meses anteriores reporta o mês mais antigo", () => {
    const n = notificacoesDeParcelas([parcela({ diaVencimento: 10 })], HOJE, MES);
    expect(n).toHaveLength(1);
    expect(n[0].dia).toBe("2026-06-10");
    expect(n[0].diasAtraso).toBe(71);
  });

  // Sem dia não há como saber se atrasou — mesma convenção dos vencimentos.
  test("parcela sem dia de vencimento não entra", () => {
    expect(notificacoesDeParcelas([parcela()], HOJE, MES)).toHaveLength(0);
  });

  test("parcela já paga no mês não entra", () => {
    const p = parcela({
      diaVencimento: 10,
      pagoPorMes: { "2026-06": true, "2026-07": true, [MES]: true },
    });
    expect(notificacoesDeParcelas([p], HOJE, MES)).toHaveLength(0);
  });

  // `proximoMesEmAberto` já trata o débito automático como resolvido.
  test("parcela em débito automático no cartão não entra", () => {
    const p = parcela({ diaVencimento: 10, cartao: CARTAO, autoDebit: true });
    expect(notificacoesDeParcelas([p], HOJE, MES, { [CARTAO]: 10 })).toHaveLength(0);
  });

  test("mês em aberto ainda no futuro não entra", () => {
    const p = parcela({ diaVencimento: 10, primeiroMes: "2026-10" });
    expect(notificacoesDeParcelas([p], HOJE, MES)).toHaveLength(0);
  });
});

describe("notificacoesDeFixas", () => {
  test("fixa comum com dia passado entra", () => {
    const n = notificacoesDeFixas([fixa({ diaVencimento: 5 })], HOJE, MES);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ id: "fixa-f1", tipo: "fixa", valor: 50000, dia: "2026-08-05" });
    expect(n[0].diasAtraso).toBe(15);
  });

  test("dia ainda por vir, sem dia, ou já marcada paga: não entra", () => {
    expect(notificacoesDeFixas([fixa({ diaVencimento: 25 })], HOJE, MES)).toHaveLength(0);
    expect(notificacoesDeFixas([fixa()], HOJE, MES)).toHaveLength(0);
    expect(
      notificacoesDeFixas([fixa({ diaVencimento: 5, pagoPorMes: { [MES]: true } })], HOJE, MES),
    ).toHaveLength(0);
  });

  // Ela sai do cartão sozinha: não é pendência de ninguém.
  test("fixa em débito automático nunca entra, mesmo com o dia passado", () => {
    const f = fixa({ diaVencimento: 5, contaCartao: CARTAO, autoDebit: true, inicio: "2026-01" });
    expect(notificacoesDeFixas([f], HOJE, MES)).toHaveLength(0);
  });

  test("fixa fora da janela inicio/fim não entra", () => {
    expect(
      notificacoesDeFixas([fixa({ diaVencimento: 5, inicio: "2026-09" })], HOJE, MES),
    ).toHaveLength(0);
  });
});

describe("notificacoesDeFaturas", () => {
  const comGasto: DadosFatura = {
    ...semDados,
    // Ciclo da fatura de agosto = julho.
    despesasCorrentes: [
      {
        id: "d1",
        descricao: "Compra",
        valor: 30000,
        data: "2026-07-10",
        categoria: "Compras",
        contaCartao: CARTAO,
      },
    ],
  };

  test("fatura com restante e dia passado entra", () => {
    const n = notificacoesDeFaturas(HOJE, MES, comGasto, {
      ...cfg,
      diaVencimentoFatura: { [CARTAO]: 8 },
    });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ id: `fatura-${CARTAO}`, tipo: "fatura", valor: 30000 });
    expect(n[0].diasAtraso).toBe(12);
  });

  test("sem dia definido cai no dia 1, a convenção do Calendário", () => {
    expect(notificacoesDeFaturas(HOJE, MES, comGasto, cfg)[0].dia).toBe("2026-08-01");
  });

  test("fatura sem restante não entra", () => {
    expect(notificacoesDeFaturas(HOJE, MES, semDados, cfg)).toHaveLength(0);
  });

  test("dia ainda por vir não entra", () => {
    expect(
      notificacoesDeFaturas(HOJE, MES, comGasto, { ...cfg, diaVencimentoFatura: { [CARTAO]: 28 } }),
    ).toHaveLength(0);
  });

  test("conta de débito não tem fatura", () => {
    const soDebito = { ...cfg, contasCartoes: ["Conta"], tipoCartao: { Conta: "debit" as const } };
    expect(notificacoesDeFaturas(HOJE, MES, comGasto, soDebito)).toHaveLength(0);
  });
});

describe("todasNotificacoes", () => {
  test("junta as três fontes com o mais atrasado primeiro", () => {
    const n = todasNotificacoes(
      HOJE,
      MES,
      semDados,
      cfg,
      [parcela({ diaVencimento: 15, pagoPorMes: { "2026-06": true, "2026-07": true } })], // 5 dias
      [fixa({ diaVencimento: 2 })], // 18 dias
    );
    expect(n.map((x) => x.tipo)).toEqual(["fixa", "parcela"]);
    expect(n.map((x) => x.diasAtraso)).toEqual([18, 5]);
  });

  test("nada em atraso dá lista vazia", () => {
    expect(todasNotificacoes(HOJE, MES, semDados, cfg, [], [])).toEqual([]);
  });
});
