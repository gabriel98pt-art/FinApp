// Ordenação da lista de locais de abastecimento pelo uso real (função pura,
// sem DOM/Firebase). A lista guardada em `cfg.locaisCarregamento` está na
// ordem em que foi criada, que não diz nada sobre a frequência: quem carrega
// quase sempre em casa via "Casa" no meio de uma dúzia de postos de estrada
// usados uma vez cada.

import type { Abastecimento } from "../types";

/**
 * Reordena `opcoes` pelo uso no histórico: primeiro os locais mais usados,
 * empate desfeito pelo abastecimento mais recente, e por último os que ainda
 * nunca apareceram (na ordem original, que é a de cadastro).
 *
 * Frequência antes de recência de propósito. Ordenar só pelo último uso faz a
 * fileira trocar de ordem a cada abastecimento — o chip que estava em primeiro
 * ontem está em terceiro hoje, e a memória muscular de quem regista a mesma
 * carga todos os dias deixa de valer. A contagem move-se devagar: o local do
 * dia a dia fica em primeiro e lá continua.
 *
 * Não filtra nada: todos os locais cadastrados saem na lista, só noutra ordem.
 */
export function ordenarLocaisPorUso(opcoes: string[], cargas: Abastecimento[]): string[] {
  const usos = new Map<string, { n: number; ultima: string }>();
  for (const c of cargas) {
    const atual = usos.get(c.local);
    if (atual === undefined) usos.set(c.local, { n: 1, ultima: c.data });
    else {
      atual.n += 1;
      if (c.data > atual.ultima) atual.ultima = c.data;
    }
  }

  // `map` + `sort` sobre os índices: `Array.prototype.sort` é estável, mas o
  // desempate explícito pela posição original deixa isso escrito em vez de
  // depender da garantia do motor.
  return opcoes
    .map((local, i) => ({ local, i, uso: usos.get(local) }))
    .sort((a, b) => {
      const na = a.uso?.n ?? 0;
      const nb = b.uso?.n ?? 0;
      if (na !== nb) return nb - na;
      const ua = a.uso?.ultima ?? "";
      const ub = b.uso?.ultima ?? "";
      if (ua !== ub) return ua < ub ? 1 : -1;
      return a.i - b.i;
    })
    .map((x) => x.local);
}
