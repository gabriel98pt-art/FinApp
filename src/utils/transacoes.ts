// Extrato geral do mês (item 22): um feed único com tudo que movimenta
// dinheiro, vindo dos seis domínios que hoje vivem em telas separadas.
//
// Três decisões sobre o que conta:
//   - despesa corrente com origem 'parc' fica de fora: ela é o lançamento
//     gerado por uma parcela, e a parcela já entra no feed pelo seu próprio
//     item (senão a compra apareceria duplicada no mês em que foi paga);
//   - pagamento de fatura (origem 'fat') FICA: é dinheiro saindo da conta de
//     facto, e num extrato isso tem que aparecer, mesmo já tendo contado a
//     compra original no mês dela;
//   - ajuste de reconciliação bancária (origem 'recon') fica de fora, dos
//     DOIS lados: não é uma transação real, é uma correção de saldo (mesma
//     regra de `despesasNosTotais`/`receitasNosTotais`, `utils/calculos.ts`).
//
// Fixa e parcela só entram no mês em que já estão resolvidas — marcadas à mão,
// ou em débito automático no cartão (fixaEfetivamentePaga/estaEfetivamentePaga
// tratam isso sem precisar de marcação nenhuma). Com `hoje`, isso tem precisão
// de DIA no mês corrente: uma cobrança do dia 27 não aparece como já feita no
// dia 8 — sem `hoje`, é o mês inteiro de uma vez, contado desde o dia 1. A fixa
// não tem data exata: cai no `diaVencimento` quando existe, senão no dia 1 do
// mês — só pra ter um lugar na ordenação. A parcela usa a data do lançamento
// real que o pagamento criou, e só cai no `diaVencimento` se esse lançamento
// faltar.

import type {
  Cents,
  DadosVeiculo,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  Receita,
  Transferencia,
  YearMonth,
} from "../types";
import { diaDoMes, mesDe } from "./calculos";
import { fixaAtivaNoMes, fixaEfetivamentePaga } from "./fatura";
import { estaEfetivamentePaga, mesesDaParcela, valorDaParcela } from "./parcelas";

export type OrigemTransacao =
  "receita" | "despesa" | "fixa" | "parcela" | "transferencia" | "carga" | "despesaVeiculo";

export interface Transacao {
  /** Chave única no feed (origem + id do item). */
  chave: string;
  /** Id da entidade, pra abrir a folha do tipo certo. */
  refId: string;
  /** Desempate de ORDEM dentro do mesmo dia — não confundir com `chave`
   *  (identidade) nem `refId` (navegação). Quando existe um lançamento real
   *  por trás do item (despesa, receita, transferência, carga, despesa de
   *  veículo, ou a despesa espelho que uma parcela paga gera), é o `id` dele
   *  — uma push key do Firebase, cronologicamente ordenável como string — e
   *  reflete a ordem real de entrada no app. Fixa nunca tem: marcar uma fixa
   *  como paga não grava hora nenhuma, e em débito automático nem "marcar"
   *  existe — o dia de vencimento passa e ela conta como paga sozinha, sem
   *  nenhum evento a ter acontecido numa hora certa. Nesses casos cai no
   *  `id` da própria entidade (fixa ou parcela) — estável, mas sem refletir
   *  quando o pagamento daquele mês em particular "aconteceu". */
  ordemId: string;
  origem: OrigemTransacao;
  data: IsoDate;
  titulo: string;
  /** Categoria (despesa) ou fonte (receita). */
  categoria?: string;
  conta?: string;
  /** Nota livre do item de origem — não confundir com `titulo`, que na receita
   *  e na despesa é a `descricao`. São dois campos diferentes do mesmo item. */
  nota?: string;
  valor: Cents;
  /** true = entra dinheiro (verde); false = sai (vermelho). */
  entrada: boolean;
}

/** Para que lado o dinheiro andou de facto — o que decide o sinal e a cor da
 *  linha no extrato.
 *
 *  Não é só `t.entrada`: um reembolso é guardado como despesa de valor
 *  NEGATIVO (ver `utils/reembolsos.ts`), portanto chega aqui com
 *  `entrada: false` e valor abaixo de zero. Pintá-lo pelo campo `entrada`
 *  sozinho escrevia "− € -75,00", com o menos duas vezes — o prefixo da
 *  direção mais o menos do próprio número. Valor negativo numa saída é
 *  dinheiro que VOLTOU: conta como entrada (verde, com "+"), e quem mostra
 *  formata o módulo do valor para o sinal não aparecer outra vez. Mesma regra
 *  que `ListaLancamentos` já aplicava nas listas de despesas. */
export function entraDinheiro(t: Pick<Transacao, "valor" | "entrada">): boolean {
  return t.valor < 0 ? !t.entrada : t.entrada;
}

export interface DadosTransacoes {
  receitas: Receita[];
  despesasCorrentes: DespesaCorrente[];
  despesasFixas: DespesaFixa[];
  parcelas: Parcela[];
  transferencias: Transferencia[];
  veiculo: DadosVeiculo;
}

export function transacoesDoMes(
  dados: DadosTransacoes,
  ym: YearMonth,
  /** Mês de hoje. Só serve para as fixas/parcelas em débito automático, que
   *  contam como pagas sem ninguém as marcar (ver `fixaEfetivamentePaga`).
   *  Opcional: sem ele, só o que está marcado à mão entra — o comportamento
   *  de sempre. */
  mesReferencia?: YearMonth,
  /** Dia de hoje. Dá precisão de DIA ao mês corrente: uma fixa/parcela em
   *  débito automático que vence dia 27 não aparece no extrato antes do dia
   *  27 — sem isto, ela aparecia já no dia 1, com a data dela no futuro. */
  hoje?: IsoDate,
  /** O nome de hoje de uma conta, a partir do id que o lançamento guarda (ver
   *  `nomeAtualDoMetodo`). Só o título de uma transferência precisa disto — é
   *  o único texto aqui que EMBUTE o nome de uma conta em vez de o deixar num
   *  campo à parte; sem ele, uma transferência antiga continuava a dizer o
   *  nome que a conta tinha no dia em que foi feita. Ausente = o id, que é o
   *  que este ficheiro sempre devolveu. */
  nomeDaConta: (id: string) => string = (id) => id,
): Transacao[] {
  const itens: Transacao[] = [];
  // Mês já fechado (passado): mesma regra de `contribuicaoFixasMes` e das
  // outras agregações por categoria/orçamento — conta o valor cheio de tudo
  // que estava ativo, marcado ou não, em vez de exigir a marcação de "pago"
  // que só faz sentido enquanto o mês ainda está a decorrer. Sem isso, uma
  // fixa/parcela manual esquecida por marcar sumia do extrato de um mês
  // passado, mas continuava a contar inteira no Orçamento e nos totais —
  // as duas telas discordando sobre o mesmo dinheiro.
  const mesFechado = mesReferencia !== undefined && ym < mesReferencia;

  for (const r of dados.receitas) {
    if (mesDe(r.data) !== ym || r.origem === "recon") continue;
    itens.push({
      chave: `receita-${r.id}`,
      refId: r.id,
      ordemId: r.id,
      origem: "receita",
      data: r.data,
      titulo: r.descricao,
      categoria: r.fonte,
      conta: r.conta,
      nota: r.nota,
      valor: r.valor,
      entrada: true,
    });
  }

  for (const d of dados.despesasCorrentes) {
    if (mesDe(d.data) !== ym || d.origem === "parc" || d.origem === "recon") continue;
    itens.push({
      chave: `despesa-${d.id}`,
      refId: d.id,
      ordemId: d.id,
      origem: "despesa",
      data: d.data,
      titulo: d.descricao,
      categoria: d.categoria,
      conta: d.contaCartao,
      nota: d.nota,
      valor: d.valor,
      entrada: false,
    });
  }

  // Fixas (gerais e do veículo) só entram no mês em que foram pagas — marcadas
  // à mão, ou em débito automático no cartão, que não precisa de marcação.
  // `deVeiculo` marca a origem porque a categoria delas se resolve diferente
  // (ver o `categoria:` abaixo) — perde-se ao concatenar as duas listas.
  const todasFixas: { f: DespesaFixa; deVeiculo: boolean }[] = [
    ...dados.despesasFixas.map((f) => ({ f, deVeiculo: false })),
    ...dados.veiculo.despesasFixas.map((f) => ({ f, deVeiculo: true })),
  ];
  for (const { f, deVeiculo } of todasFixas) {
    if (mesFechado ? !fixaAtivaNoMes(f, ym) : !fixaEfetivamentePaga(f, ym, mesReferencia, hoje))
      continue;
    itens.push({
      chave: `fixa-${f.id}-${ym}`,
      refId: f.id,
      // Sem hora de quando foi marcada — ver a nota em `Transacao.ordemId`.
      ordemId: f.id,
      origem: "fixa",
      data: diaDoMes(ym, f.diaVencimento),
      titulo: f.descricao,
      // Ajuste F do lote de 30/08: despesa fixa do veículo perdeu a
      // categoria escolhida — a cor/ícone que usa agora é sempre a
      // "Veículo" única (Definições › Veículo), mesmo pra registos antigos
      // que ainda têm uma categoria de antes gravada (ex. "Seguro") — o
      // valor guardado no campo é ignorado aqui de propósito, não só nos
      // novos.
      categoria: deVeiculo ? "Veículo" : f.categoria,
      conta: f.contaCartao,
      nota: f.nota,
      valor: f.valor,
      entrada: false,
    });
  }

  // Parcelas, como as fixas: só o mês já pago entra. Antes entrava qualquer mês
  // do plano — incluindo os que ainda nem chegaram — sempre com a data do
  // vencimento do cartão, um dia inventado. Uma parcela de agosto com
  // vencimento a 20 aparecia no extrato a 20/08 estando-se a 5/08.
  //
  // E a data é a do lançamento REAL que `pagarMesParcela`/`pagarFatura` criam
  // (origem 'parc'), que é quando o dinheiro saiu mesmo. Esse lançamento fica
  // fora do feed pelo seu próprio lado, para a compra não aparecer duas vezes
  // — mas a data dele é a boa. O `diaVencimento` fica só como último recurso,
  // para dados incoerentes (mês marcado pago sem lançamento nenhum).
  for (const p of dados.parcelas) {
    if (!mesesDaParcela(p).includes(ym)) continue;
    if (!mesFechado && !estaEfetivamentePaga(p, ym, mesReferencia, hoje)) continue;
    const idx = mesesDaParcela(p).indexOf(ym);
    // "quit" é a quitação antecipada: UM lançamento que varreu vários meses de
    // uma vez. Todos eles herdam essa data — é o dia real em que se pagou,
    // ainda que não discrimine mês a mês.
    const real = dados.despesasCorrentes.find(
      (d) =>
        d.origem === "parc" &&
        d.parcelaId === p.id &&
        (d.parcelaMes === ym || d.parcelaMes === "quit"),
    );
    itens.push({
      chave: `parcela-${p.id}-${ym}`,
      refId: p.id,
      // `real.id`, quando existe, é a despesa espelho que o pagamento criou —
      // mesma push key que dá a data. Sem ela (paga sozinha por débito
      // automático, sem lançamento nenhum), cai no id da própria parcela.
      ordemId: real?.id ?? p.id,
      origem: "parcela",
      data: real?.data ?? diaDoMes(ym, p.diaVencimento),
      titulo: `${p.descricao} (${idx + 1}/${p.numParcelas})`,
      categoria: p.categoria ?? "Parcelas",
      conta: p.cartao ?? undefined,
      nota: p.nota,
      valor: valorDaParcela(p, ym),
      entrada: false,
    });
  }

  for (const t of dados.transferencias) {
    if (mesDe(t.data) !== ym) continue;
    itens.push({
      chave: `transferencia-${t.id}`,
      refId: t.id,
      ordemId: t.id,
      origem: "transferencia",
      data: t.data,
      titulo: t.descricao || `${nomeDaConta(t.de)} → ${nomeDaConta(t.para)}`,
      categoria: "Transferência",
      conta: t.de,
      nota: t.nota,
      valor: t.valor,
      entrada: false,
    });
  }

  for (const c of dados.veiculo.cargas) {
    if (mesDe(c.data) !== ym) continue;
    itens.push({
      chave: `carga-${c.id}`,
      refId: c.id,
      ordemId: c.id,
      origem: "carga",
      data: c.data,
      titulo: c.local,
      categoria: "Carga Elétrica",
      conta: c.contaCartao,
      nota: c.nota,
      valor: c.custo,
      entrada: false,
    });
  }

  for (const d of dados.veiculo.despesas) {
    if (mesDe(d.data) !== ym) continue;
    itens.push({
      chave: `despesaVeiculo-${d.id}`,
      refId: d.id,
      ordemId: d.id,
      origem: "despesaVeiculo",
      data: d.data,
      // Com nome próprio, o par título/nota é o mesmo da despesa corrente.
      // Sem ele (registos anteriores ao campo `descricao`), a nota volta a
      // fazer de título — e aí não se repete em `nota`, senão aparecia duas
      // vezes na mesma linha; sem nota nenhuma sobra a categoria (só em
      // registos velhos — de agora em diante `descricao` é obrigatória).
      titulo: d.descricao || d.nota || d.categoria,
      // Ajuste F do lote de 30/08: mesma regra da fixa do veículo, acima —
      // categoria fixa em "Veículo", ignorando o que estiver gravado no
      // campo (inclusive em registos antigos).
      categoria: "Veículo",
      conta: d.contaCartao,
      nota: d.descricao ? d.nota : undefined,
      valor: d.valor,
      entrada: false,
    });
  }

  // Mais recente primeiro; empate no mesmo dia desempata por `ordemId` — que é
  // uma push key do Firebase (cronologicamente ordenável como string) sempre
  // que existe um lançamento real por trás do item, então reflete a ordem de
  // entrada de verdade. Era `chave` antes, e isso agrupava por TIPO (o prefixo
  // "despesa-"/"fixa-"/"parcela-" dominava o localeCompare): um dia com
  // correntes, parcelas e fixas misturadas mostrava todas as correntes juntas,
  // depois as fixas, depois as parcelas — nunca intercaladas pela ordem real.
  return itens.sort((a, b) =>
    a.data === b.data ? a.ordemId.localeCompare(b.ordemId) : a.data < b.data ? 1 : -1,
  );
}

// Filtro de transações (Transações → filtrar por categoria/conta).
//
// O filtro de categoria é um valor só, com quatro formas possíveis:
//   - vazio: sem filtro, tudo passa;
//   - "Receita"/"Despesa"/"Transferência interna": casa pelo TIPO;
//   - qualquer outro texto: o nome de uma categoria de despesa. Despesa
//     corrente, fixa e parcela usam a mesma lista `cfg.categoriasDespesa`
//     (ver SeletorCategoria nas três telas), por isso "Despesa" cobre as três
//     origens, e uma categoria específica também — só mais estreito.
// Veículo (carga/despesaVeiculo) fica fora dos dois filtros — não tem
// categoria escolhível desde o ajuste F do lote de 30/08 (é sempre a fixa
// "Veículo") e não foi pedido aqui.

export const FILTRO_RECEITA = "Receita";
export const FILTRO_DESPESA = "Despesa";
export const FILTRO_TRANSFERENCIA = "Transferência interna";

const ORIGENS_DESPESA = new Set<OrigemTransacao>(["despesa", "fixa", "parcela"]);

export function passaFiltroCategoria(t: Transacao, filtro: string): boolean {
  if (!filtro) return true;
  if (filtro === FILTRO_RECEITA) return t.origem === "receita";
  if (filtro === FILTRO_TRANSFERENCIA) return t.origem === "transferencia";
  if (filtro === FILTRO_DESPESA) return ORIGENS_DESPESA.has(t.origem);
  return ORIGENS_DESPESA.has(t.origem) && t.categoria === filtro;
}

/** Filtro de conta/cartão: vazio deixa tudo passar, senão bate com `t.conta`
 *  (só as origens que guardam conta a preenchem — ver `transacoesDoMes`). */
export function passaFiltroConta(t: Transacao, filtro: string): boolean {
  return !filtro || t.conta === filtro;
}

export function filtrarTransacoes(
  itens: Transacao[],
  filtroCategoria: string,
  filtroConta: string,
): Transacao[] {
  return itens.filter(
    (t) => passaFiltroCategoria(t, filtroCategoria) && passaFiltroConta(t, filtroConta),
  );
}
