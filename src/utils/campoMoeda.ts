// Teclado do campo de dinheiro (ver components/CampoMoeda.tsx). Função pura:
// dado o valor atual em centavos e a tecla premida, diz qual é o valor novo.
//
// O campo representa sempre os CENTAVOS digitados até agora, como um campo de
// valor de multibanco: cada dígito entra pela direita e empurra os outros —
// "1", "2", "3" dá 0,01 → 0,12 → 1,23. Nunca se escreve ponto nem vírgula.

import type { Cents } from "../types";

/** Teto de segurança: acima disto a aritmética de inteiros do JS deixa de ser
 *  exata, e um dígito a mais passaria a dar um valor errado em silêncio. */
const MAXIMO = Number.MAX_SAFE_INTEGER;

/** `undefined` = tecla não tratada, deixa passar (Tab, setas, atalhos…).
 *  `null` = campo vazio. */
export type ResultadoTecla = Cents | null | undefined;

export function aplicarTecla(valor: Cents | null, tecla: string): ResultadoTecla {
  if (/^\d$/.test(tecla)) {
    const atual = valor ?? 0;
    const novo = atual * 10 + Number(tecla);
    // No teto, ignora o dígito em vez de estourar — o campo pára de crescer.
    return novo > MAXIMO ? atual : novo;
  }
  if (tecla === "Backspace" || tecla === "Delete") {
    const atual = valor ?? 0;
    const novo = Math.floor(atual / 10);
    // Apagar o último dígito devolve o campo ao vazio, não a "0,00" — assim
    // um campo que pode ficar por preencher (o ajuste manual da fatura) sabe
    // que o usuário o esvaziou de propósito.
    return novo === 0 ? null : novo;
  }
  return undefined;
}
