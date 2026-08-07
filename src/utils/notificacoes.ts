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

import type { Cents, ConfigConta, DespesaFixa, IsoDate, Parcela, YearMonth } from "../types";
import { diasEntre } from "./calculos";
import { calcularFatura, fixaAtivaNoMes, fixaEfetivamentePaga, type DadosFatura } from "./fatura";
import { diaVencimentoEfetivo, proximoMesEmAberto, valorDaParcela } from "./parcelas";
import { diaDoMes } from "./vencimentos";

export type TipoNotificacao = "parcela" | "fixa" | "fatura";

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  /** Id da parcela/fixa, ou o nome do cartão na fatura. */
  refId: string;
  titulo: string;
  detalhe?: string;
  valor: Cents;
  /** Dia do vencimento — já passado, por construção. */
  dia: IsoDate;
  diasAtraso: number;
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
      titulo: `Fatura ${cartao}`,
      detalhe: "Cartão de crédito",
      valor: fatura.restante,
      dia: data,
      diasAtraso: atraso(data, hoje),
    });
  }
  return notificacoes;
}

/** As três fontes juntas, o mais atrasado primeiro. */
export function todasNotificacoes(
  hoje: IsoDate,
  mes: YearMonth,
  dados: DadosFatura,
  cfg: ConfigConta,
  parcelas: Parcela[],
  fixas: DespesaFixa[],
): Notificacao[] {
  return [
    ...notificacoesDeParcelas(parcelas, hoje, mes, cfg.diaVencimentoFatura),
    ...notificacoesDeFixas(fixas, hoje, mes),
    ...notificacoesDeFaturas(hoje, mes, dados, cfg),
  ].sort((a, b) => b.diasAtraso - a.diasAtraso);
}
