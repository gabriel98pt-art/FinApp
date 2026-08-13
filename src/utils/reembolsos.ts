// Reembolso de despesa (o jantar em grupo que os amigos devolvem depois).
//
// O reembolso é guardado como uma DespesaCorrente de valor NEGATIVO, na mesma
// categoria da original e com `origem: "reemb"`. Não é receita: dinheiro que
// volta para quem o adiantou não é dinheiro novo, e lançá-lo do outro lado
// inflava as Receitas com o que já era dele. Como despesa negativa, a
// categoria neta sozinha em toda a parte do app que soma — donut, orçamento,
// KPIs — sem essas somas precisarem de saber que reembolsos existem.
//
// Este ficheiro trata só do que a aritmética simples não resolve: juntar os
// reembolsos que apontam para uma despesa e dizer quanto dela sobrou.

import type { Cents, DespesaCorrente, Id } from "../types";

/** Um reembolso é o que tem origem 'reemb'. O valor negativo é consequência
 *  disso, não a definição — um dia pode haver reembolso de zero (estorno
 *  cancelado) e continua a ser um reembolso. */
export function ehReembolso(d: Pick<DespesaCorrente, "origem">): boolean {
  return d.origem === "reemb";
}

/** Reembolsos que apontam para esta despesa. */
export function reembolsosDe(despesas: DespesaCorrente[], despesaId: Id): DespesaCorrente[] {
  return despesas.filter((d) => ehReembolso(d) && d.reembolsoDeId === despesaId);
}

export interface LiquidoDaDespesa {
  /** O que foi pago na altura, sempre positivo. */
  bruto: Cents;
  /** Quanto voltou, como número POSITIVO — os lançamentos são negativos, mas
   *  quem mostra isto quer escrever "75,00 reembolsado", não "-75,00". */
  reembolsado: Cents;
  /** O que sobrou por pagar de facto: bruto − reembolsado. */
  liquido: Cents;
  /** Há alguma coisa para mostrar? Falso quando ninguém reembolsou nada, e é
   *  isto que a linha da lista consulta para não escrever "0,00 reembolsado"
   *  em todas as despesas do mês. */
  temReembolso: boolean;
}

/** Quanto sobrou de uma despesa depois do que voltou.
 *
 *  O `liquido` pode ficar NEGATIVO quando devolveram mais do que se pagou —
 *  acontece com um estorno que inclui juros ou com um lançamento errado. Não é
 *  travado aqui: esconder o negativo faria a linha mentir sobre o que está
 *  guardado, e quem quiser tratá-lo (o donut trata) fá-lo no seu sítio. */
export function liquidoDaDespesa(
  despesa: DespesaCorrente,
  despesas: DespesaCorrente[],
): LiquidoDaDespesa {
  const ligados = reembolsosDe(despesas, despesa.id);
  // Os lançamentos são negativos e aqui quer-se o total em positivo. Subtrair
  // dentro do reduce, em vez de negar a soma no fim: `-(0)` dá `-0`, que
  // sobrevive à formatação e escreveria "-0,00 reembolsado" numa despesa que
  // ninguém reembolsou.
  const reembolsado = ligados.reduce((s, r) => s - r.valor, 0);

  return {
    bruto: despesa.valor,
    reembolsado,
    liquido: despesa.valor - reembolsado,
    temReembolso: ligados.length > 0,
  };
}
