// Lembretes do sino do header: o que já venceu e continua por pagar.
//
// Não há "marcar como lido" nem nada gravado: a lista é sempre o retrato de
// AGORA. Paga a parcela ou a fatura e ela sai sozinha no render seguinte,
// porque deixa de bater na condição. Dispensar um aviso de dívida real sem
// pagar a dívida não faria sentido.
//
// Uma linha por pendência, nunca uma por mês em atraso: fixas e faturas olham
// só para o mês corrente, e a parcela reporta o seu mês em aberto MAIS ANTIGO
// (o que `proximoMesEmAberto` devolve). Limitar também a parcela ao mês
// corrente calaria justamente o caso mais grave — quem está três meses
// atrasado deixaria de ser avisado —, e o "há N dias" já diz o tamanho do
// atraso sem precisar de somar meses.

import type {
  Cents,
  ConfigConta,
  DespesaCorrente,
  DespesaFixa,
  IsoDate,
  Parcela,
  TipoNotificacao,
  YearMonth,
} from "../types";
import { diasEntre } from "./calculos";
import { calcularFatura, fixaAtivaNoMes, fixaEfetivamentePaga, type DadosFatura } from "./fatura";
import { diaVencimentoEfetivo, proximoMesEmAberto, valorDaParcela } from "./parcelas";
import { statusOrcamentoMes } from "./orcamento";
import { diaDoMes } from "./vencimentos";
import { nomeAtualDoMetodo } from "./instituicoes";

// Reexportado por conveniência — quem já importava TipoNotificacao daqui
// (NotificacoesSino.tsx) continua a funcionar sem mudar o import.
export type { TipoNotificacao };

/** Ordem estável usada quando `cfg.notificacoesAtivas` está ausente — conta
 *  nova nasce com os 4 tipos ativos, sem precisar marcar nada. */
export const TIPOS_NOTIFICACAO: TipoNotificacao[] = ["parcela", "fixa", "fatura", "orcamento"];

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  /** Id da parcela/fixa, o nome do cartão na fatura, ou a categoria no
   *  orçamento. */
  refId: string;
  titulo: string;
  detalhe?: string;
  valor: Cents;
  /** Dia do vencimento — já passado, por construção. Ausente em "orcamento":
   *  estourar um teto não tem "dia", é um estado do mês inteiro. */
  dia?: IsoDate;
  diasAtraso?: number;
  /** Só em "orcamento": % do teto já gasto (sempre > 100, por construção). */
  pct?: number;
}

/** Dia do mês em que a fatura do cartão vence. Sem nada definido, o dia 1 — a
 *  mesma convenção do Calendário. */
const DIA_FATURA_PADRAO = 1;

function atraso(dia: IsoDate, hoje: IsoDate): number {
  return diasEntre(dia, hoje);
}

/** Parcelas cujo mês em aberto mais antigo já passou do dia de vencimento.
 *
 *  `proximoMesEmAberto` já trata débito automático como resolvido, portanto
 *  uma parcela que sai sozinha do cartão não aparece aqui. Sem dia de
 *  vencimento não há como saber se atrasou — não entra (mesma convenção de
 *  `vencimentosDeParcelas`). */
export function notificacoesDeParcelas(
  parcelas: Parcela[],
  hoje: IsoDate,
  mes: YearMonth,
  diaVencimentoFatura?: Record<string, number>,
): Notificacao[] {
  const notificacoes: Notificacao[] = [];
  for (const p of parcelas) {
    const emAberto = proximoMesEmAberto(p, mes);
    if (emAberto === undefined || emAberto > mes) continue;
    const dia = diaVencimentoEfetivo(p, diaVencimentoFatura);
    if (!dia) continue;
    const data = diaDoMes(emAberto, dia);
    if (data >= hoje) continue;
    notificacoes.push({
      id: `parcela-${p.id}`,
      tipo: "parcela",
      refId: p.id,
      titulo: p.descricao,
      detalhe: p.categoria,
      valor: valorDaParcela(p, emAberto),
      dia: data,
      diasAtraso: atraso(data, hoje),
    });
  }
  return notificacoes;
}

/** Fixas ativas no mês, por pagar, cujo dia já passou.
 *
 *  `fixaEfetivamentePaga` exclui sozinha as que saem por débito automático no
 *  cartão: essas não dependem de ninguém e não são pendência. */
export function notificacoesDeFixas(
  fixas: DespesaFixa[],
  hoje: IsoDate,
  mes: YearMonth,
): Notificacao[] {
  return fixas
    .filter(
      (f) =>
        f.diaVencimento &&
        fixaAtivaNoMes(f, mes) &&
        !fixaEfetivamentePaga(f, mes, mes) &&
        diaDoMes(mes, f.diaVencimento) < hoje,
    )
    .map((f) => {
      const data = diaDoMes(mes, f.diaVencimento!);
      return {
        id: `fixa-${f.id}`,
        tipo: "fixa" as const,
        refId: f.id,
        titulo: f.descricao,
        detalhe: f.categoria,
        valor: f.valor,
        dia: data,
        diasAtraso: atraso(data, hoje),
      };
    });
}

/** Faturas de cartão de crédito com saldo por pagar depois do dia de
 *  vencimento. */
export function notificacoesDeFaturas(
  hoje: IsoDate,
  mes: YearMonth,
  dados: DadosFatura,
  cfg: ConfigConta,
): Notificacao[] {
  const cartoes = cfg.contasCartoes.filter((c) => cfg.tipoCartao?.[c] === "credit");
  const notificacoes: Notificacao[] = [];
  for (const cartao of cartoes) {
    const fatura = calcularFatura(cartao, mes, dados, cfg);
    if (fatura.restante <= 0) continue;
    const data = diaDoMes(mes, cfg.diaVencimentoFatura?.[cartao] ?? DIA_FATURA_PADRAO);
    if (data >= hoje) continue;
    notificacoes.push({
      id: `fatura-${cartao}`,
      tipo: "fatura",
      refId: cartao,
      // O id do cartão é estável; o nome muda quando a pessoa o renomeia.
      titulo: `Fatura ${nomeAtualDoMetodo(cfg, cartao)}`,
      detalhe: "Cartão de crédito",
      valor: fatura.restante,
      dia: data,
      diasAtraso: atraso(data, hoje),
    });
  }
  return notificacoes;
}

/** Categorias com teto estourado no mês corrente. Sempre o mês de hoje —
 *  igual às outras três fontes —, nunca o do seletor do header: um teto
 *  estourado não deixa de o estar por se olhar outro mês no resto do app. */
export function notificacoesDeOrcamento(
  despesasCorrentes: DespesaCorrente[],
  parcelas: Parcela[],
  orcamentos: Record<string, Cents>,
  mes: YearMonth,
  /** Dia de hoje — as outras três fontes já o recebiam. É ele que impede o
   *  sino de anunciar um teto estourado por uma parcela em débito automático
   *  que ainda não venceu. */
  hoje?: IsoDate,
): Notificacao[] {
  return statusOrcamentoMes(despesasCorrentes, parcelas, orcamentos, mes, mes, hoje)
    .filter((s) => s.estourado)
    .map((s) => ({
      id: `orcamento-${s.categoria}`,
      tipo: "orcamento" as const,
      refId: s.categoria,
      titulo: s.categoria,
      valor: s.gasto - s.teto,
      pct: s.pct,
    }));
}

/** As quatro fontes juntas: pendências vencidas primeiro (a mais atrasada no
 *  topo), tetos estourados depois (o mais estourado primeiro) — atraso real
 *  de pagamento pesa mais que estourar uma categoria. */
export function todasNotificacoes(
  hoje: IsoDate,
  mes: YearMonth,
  dados: DadosFatura,
  cfg: ConfigConta,
  parcelas: Parcela[],
  fixas: DespesaFixa[],
): Notificacao[] {
  const vencidas = [
    ...notificacoesDeParcelas(parcelas, hoje, mes, cfg.diaVencimentoFatura),
    ...notificacoesDeFixas(fixas, hoje, mes),
    ...notificacoesDeFaturas(hoje, mes, dados, cfg),
  ].sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
  const estouradas = notificacoesDeOrcamento(
    dados.despesasCorrentes,
    parcelas,
    cfg.orcamentos,
    mes,
    hoje,
  ).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const ativos = cfg.notificacoesAtivas ?? TIPOS_NOTIFICACAO;
  return [...vencidas, ...estouradas].filter((n) => ativos.includes(n.tipo));
}
