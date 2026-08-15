// Motor de fatos e planeamento. Este é o ficheiro que decide o que a app
// AFIRMA sobre o dinheiro de alguém — a IA a jusante só reescreve o que sai
// daqui. Um erro aqui vira um conselho errado com ar de certeza, por isso o
// que se testa é sobretudo aquilo que o motor NÃO pode fazer: sugerir separar
// dinheiro que não existe, tratar um mês solitário como tendência, ou perder
// uma fatura só porque ela vence depois da virada do mês.

import { describe, expect, test } from "vitest";
import type { ConfigConta, DespesaCorrente, DespesaFixa, Fundo, Receita } from "../types";
import { CONFIG_PADRAO } from "../constants/configPadrao";
import type { ContextoCopiloto } from "./copiloto";
import { progressoFundo, responderPergunta } from "./copiloto";
import { buildFinanceSnapshot, gerarPlano, mediasPorCategoria } from "./copilotoPlano";

function ctx(extra: Partial<ContextoCopiloto> = {}): ContextoCopiloto {
  return {
    receitas: [],
    despesas: [],
    despesasFixas: [],
    parcelas: [],
    veiculo: { cargas: [], despesas: [], despesasFixas: [], quilometragem: [] },
    eventos: [],
    fundos: [],
    cfg: CONFIG_PADRAO,
    mesReal: "2026-07",
    diaDeHoje: 15,
    ...extra,
  };
}

const cfgCom = (extra: Partial<ConfigConta>): ConfigConta => ({ ...CONFIG_PADRAO, ...extra });

const receita = (data: string, valor: number): Receita => ({
  id: `r-${data}-${valor}`,
  data,
  valor,
  descricao: "Salário",
  fonte: "Salário",
});

const despesa = (data: string, valor: number, categoria = "Alimentação"): DespesaCorrente => ({
  id: `d-${data}-${valor}-${categoria}`,
  data,
  valor,
  descricao: categoria,
  categoria,
  contaCartao: "Conta",
});

const fixa = (valor: number, diaVencimento: number): DespesaFixa => ({
  id: "fx1",
  descricao: "Renda",
  valor,
  categoria: "Casa",
  diaVencimento,
  inicio: "2026-01",
  pagoPorMes: {},
});

const fundo = (extra: Partial<Fundo> = {}): Fundo => ({
  id: "f1",
  nome: "Viagem",
  alvo: 200000,
  atual: 50000,
  ...extra,
});

describe("progressoFundo", () => {
  test("sem prazo, diz quanto falta mas não inventa um valor por mês", () => {
    const p = progressoFundo(fundo(), "2026-07");

    expect(p.falta).toBe(150000);
    expect(p.pct).toBe(25);
    expect(p.mesesRestantes).toBeNull();
    expect(p.porMes).toBeNull();
  });

  test("com prazo, o mês corrente conta — ainda dá para separar dinheiro nele", () => {
    // Julho → dezembro são 6 meses contando julho, não 5.
    const p = progressoFundo(fundo({ prazo: "2026-12-31" }), "2026-07");

    expect(p.mesesRestantes).toBe(6);
    expect(p.porMes).toBe(25000);
  });

  test("arredonda o valor mensal para CIMA, senão a soma fica debaixo do alvo", () => {
    // 100 cêntimos em 3 meses: 33,33… → 34, porque 33×3 = 99 não lá chega.
    const p = progressoFundo(fundo({ alvo: 100, atual: 0, prazo: "2026-09-30" }), "2026-07");

    expect(p.porMes).toBe(34);
  });

  test("fundo completo não pede mais nada", () => {
    const p = progressoFundo(fundo({ atual: 200000, prazo: "2026-12-31" }), "2026-07");

    expect(p.concluido).toBe(true);
    expect(p.falta).toBe(0);
    expect(p.porMes).toBeNull();
  });

  test("prazo passado é assinalado em vez de dar um valor mensal negativo", () => {
    const p = progressoFundo(fundo({ prazo: "2026-03-31" }), "2026-07");

    expect(p.prazoVencido).toBe(true);
    expect(p.porMes).toBeNull();
  });

  test("guardar acima do alvo não passa dos 100%", () => {
    expect(progressoFundo(fundo({ atual: 300000 }), "2026-07").pct).toBe(100);
  });
});

describe("intent de fundo por nome", () => {
  test("responde com progresso e quanto por mês até ao prazo", () => {
    const resp = responderPergunta(
      "o que faço este mês para chegar na viagem até dezembro?",
      ctx({ fundos: [fundo({ prazo: "2026-12-31" })] }),
    );

    expect(resp).toMatch(/Viagem/);
    // 6 meses contando julho, e o valor mensal que daí sai.
    expect(resp).toMatch(/<b>6<\/b> mês\(es\)/);
    expect(resp).toMatch(/€ 250,00<\/b> por mês/);
  });

  test("com linguagem de meta, o fundo ganha à categoria com o mesmo nome", () => {
    const resp = responderPergunta(
      "quanto falta para a viagem?",
      ctx({
        fundos: [fundo()],
        cfg: cfgCom({ categoriasDespesa: ["Viagem"] }),
        despesas: [despesa("2026-07-02", 5000, "Viagem")],
      }),
    );

    expect(resp).toMatch(/fundo/i);
  });

  test("sem linguagem de meta, 'gastei na viagem' continua a ser gasto", () => {
    // O desempate importa: um fundo e uma categoria podem chamar-se igual, e
    // a pergunta é que diz qual dos dois interessa.
    const resp = responderPergunta(
      "quanto gastei em viagem este mes?",
      ctx({
        fundos: [fundo()],
        cfg: cfgCom({ categoriasDespesa: ["Viagem"] }),
        despesas: [despesa("2026-07-02", 5000, "Viagem")],
      }),
    );

    expect(resp).toMatch(/Gastou/);
    expect(resp).not.toMatch(/fundo/i);
  });

  test("a pergunta agregada de poupança passa a mencionar os fundos por completar", () => {
    const resp = responderPergunta(
      "como está a minha poupança?",
      ctx({ fundos: [fundo({ prazo: "2026-12-31" })], cfg: cfgCom({ metaPoupanca: 50000 }) }),
    );

    expect(resp).toMatch(/meta de poupança/i);
    expect(resp).toMatch(/fundo\(s\) por completar/);
  });
});

describe("buildFinanceSnapshot", () => {
  test("saldo disponível parte dos saldos iniciais e acumula os meses todos", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ saldosIniciais: { Conta: 100000 } }),
        receitas: [receita("2026-06-01", 200000), receita("2026-07-01", 200000)],
        despesas: [despesa("2026-06-05", 50000), despesa("2026-07-05", 30000)],
      }),
    );

    // 100.000 inicial + 400.000 entradas − 80.000 saídas.
    expect(s.saldoDisponivel).toBe(420000);
  });

  test("conta o mês corrente separadamente do acumulado", () => {
    const s = buildFinanceSnapshot(
      ctx({
        receitas: [receita("2026-06-01", 200000), receita("2026-07-01", 100000)],
        despesas: [despesa("2026-07-05", 30000)],
      }),
    );

    expect(s.receitasDoMes).toBe(100000);
    expect(s.despesasDoMes).toBe(30000);
    expect(s.saldoDoMes).toBe(70000);
  });

  test("a janela de 30 dias atravessa a virada do mês", () => {
    // Fixa que vence no dia 5 de agosto, estando hoje a 15 de julho: está
    // dentro dos 30 dias e tem de aparecer. Olhar só para o mês corrente
    // perdia justamente a saída que aí vem.
    const s = buildFinanceSnapshot(
      ctx({
        diaDeHoje: 15,
        despesasFixas: [fixa(70000, 5)],
      }),
    );

    expect(s.proximos30Dias.map((p) => p.dia)).toContain("2026-08-05");
  });

  test("não conta o que vence depois da janela de 30 dias", () => {
    const s = buildFinanceSnapshot(
      ctx({
        diaDeHoje: 1,
        despesasFixas: [fixa(70000, 20)],
      }),
    );

    // Dia 20 de agosto está a mais de 30 dias de 1 de julho.
    expect(s.proximos30Dias.map((p) => p.dia)).not.toContain("2026-08-20");
  });

  test("estado do orçamento marca o que estourou", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ orcamentos: { Alimentação: 20000 } }),
        despesas: [despesa("2026-07-03", 30000)],
      }),
    );

    expect(s.orcamento[0]).toMatchObject({
      categoria: "Alimentação",
      teto: 20000,
      gasto: 30000,
      estourou: true,
      pctUsado: 150,
    });
  });
});

describe("mediasPorCategoria", () => {
  test("um mês solitário não vira tendência", () => {
    // Só junho tem dados: abaixo do mínimo de meses, a categoria não entra —
    // dizer "está 300% acima da média" com uma amostra de um mês seria dar
    // ares de padrão a uma coincidência.
    const linhas = mediasPorCategoria(
      ctx({ despesas: [despesa("2026-06-02", 10000), despesa("2026-07-02", 40000)] }),
      "2026-07",
    );

    expect(linhas).toHaveLength(0);
  });

  test("com meses suficientes, compara o mês corrente com a média", () => {
    const linhas = mediasPorCategoria(
      ctx({
        despesas: [
          despesa("2026-04-02", 10000),
          despesa("2026-05-02", 10000),
          despesa("2026-06-02", 10000),
          despesa("2026-07-02", 20000),
        ],
      }),
      "2026-07",
    );

    expect(linhas[0]).toMatchObject({
      categoria: "Alimentação",
      media: 10000,
      gastoAtual: 20000,
      mesesUsados: 3,
      desvio: 10000,
      desvioPct: 100,
    });
  });

  test("o mês corrente não entra na sua própria média", () => {
    const linhas = mediasPorCategoria(
      ctx({
        despesas: [
          despesa("2026-04-02", 10000),
          despesa("2026-05-02", 10000),
          despesa("2026-06-02", 10000),
          despesa("2026-07-02", 99999),
        ],
      }),
      "2026-07",
    );

    // Se julho entrasse, a média subia — e o desvio encolhia sozinho.
    expect(linhas[0].media).toBe(10000);
  });
});

describe("gerarPlano", () => {
  test("nunca sugere separar dinheiro que não existe", () => {
    // Fundo a pedir 25.000/mês, mas sem saldo nenhum para lá chegar.
    const s = buildFinanceSnapshot(ctx({ fundos: [fundo({ prazo: "2026-12-31" })] }));
    const plano = gerarPlano(s);

    const acoes = plano.passos.filter((p) => p.acao);
    expect(acoes).toHaveLength(0);
    // Mas o assunto continua a ser levantado, só que sem ação.
    expect(plano.passos.some((p) => p.titulo.includes("Viagem"))).toBe(true);
  });

  test("com folga suficiente, a contribuição vira ação executável", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ saldosIniciais: { Conta: 500000 } }),
        fundos: [fundo({ prazo: "2026-12-31" })],
      }),
    );
    const plano = gerarPlano(s);
    const comAcao = plano.passos.find((p) => p.acao);

    expect(comAcao?.acao).toMatchObject({
      tipo: "contribuirFundo",
      fundoId: "f1",
      nomeFundo: "Viagem",
      valor: 25000,
    });
  });

  test("todo passo carrega os números que o sustentam", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ orcamentos: { Alimentação: 20000 }, saldosIniciais: { Conta: 500000 } }),
        despesas: [despesa("2026-07-03", 30000)],
        fundos: [fundo({ prazo: "2026-12-31" })],
      }),
    );
    const plano = gerarPlano(s);

    // Nenhuma afirmação sem valor por trás — é o contrato desta camada.
    expect(plano.passos.length).toBeGreaterThan(0);
    for (const passo of plano.passos) {
      expect(passo.dados.length).toBeGreaterThan(0);
      expect(passo.porque).toBeTruthy();
    }
  });

  test("orçamento estourado é mais urgente que separar para um fundo", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ orcamentos: { Alimentação: 20000 }, saldosIniciais: { Conta: 500000 } }),
        despesas: [despesa("2026-07-03", 30000)],
        fundos: [fundo({ prazo: "2026-12-31" })],
      }),
    );
    const plano = gerarPlano(s);

    const iOrcamento = plano.passos.findIndex((p) => p.id.startsWith("orcamento-"));
    const iFundo = plano.passos.findIndex((p) => p.id.startsWith("fundo-"));
    expect(iOrcamento).toBeGreaterThanOrEqual(0);
    expect(iFundo).toBeGreaterThan(iOrcamento);
  });

  test("conta sem nada a apontar diz isso, em vez de inventar um problema", () => {
    const plano = gerarPlano(buildFinanceSnapshot(ctx()));

    expect(plano.passos).toHaveLength(1);
    expect(plano.passos[0].id).toBe("sem-alertas");
  });

  test("no máximo 5 passos, os mais urgentes primeiro", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({
          orcamentos: { Alimentação: 1000, Casa: 1000, Transporte: 1000 },
          saldosIniciais: { Conta: 500000 },
        }),
        despesas: [
          despesa("2026-07-03", 30000),
          despesa("2026-07-03", 30000, "Casa"),
          despesa("2026-07-03", 30000, "Transporte"),
        ],
        fundos: [fundo({ prazo: "2026-12-31" }), fundo({ id: "f2", nome: "Carro" })],
      }),
    );
    const plano = gerarPlano(s);

    expect(plano.passos.length).toBeLessThanOrEqual(5);
    const prioridades = plano.passos.map((p) => p.prioridade);
    expect([...prioridades].sort((a, b) => a - b)).toEqual(prioridades);
  });

  test("os três cenários nunca separam mais do que a folga", () => {
    const s = buildFinanceSnapshot(
      ctx({
        cfg: cfgCom({ saldosIniciais: { Conta: 100000 }, metaPoupanca: 999999 }),
        fundos: [fundo({ prazo: "2026-08-31" })],
      }),
    );
    const plano = gerarPlano(s);

    expect(plano.cenarios).toHaveLength(3);
    for (const c of plano.cenarios) {
      expect(c.separar).toBeLessThanOrEqual(Math.max(0, plano.margem));
      expect(c.sobra).toBeGreaterThanOrEqual(0);
    }
  });

  test("margem negativa não produz cenários com valores negativos", () => {
    const s = buildFinanceSnapshot(
      ctx({
        despesasFixas: [fixa(500000, 20)],
      }),
    );
    const plano = gerarPlano(s);

    expect(plano.margem).toBeLessThan(0);
    for (const c of plano.cenarios) {
      expect(c.separar).toBe(0);
      expect(c.sobra).toBe(0);
    }
  });
});
