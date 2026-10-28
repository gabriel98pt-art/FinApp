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
  // O campo pode receber um valor negativo de fora (o saldo calculado de uma
  // conta no vermelho). Trabalha-se no valor absoluto e o sinal mantém-se; ao
  // esvaziar, o sinal desaparece com o valor.
  const atual = valor ?? 0;
  const sinal = atual < 0 ? -1 : 1;
  const abs = Math.abs(atual);
  if (/^\d$/.test(tecla)) {
    const novo = abs * 10 + Number(tecla);
    // No teto, ignora o dígito em vez de estourar — o campo pára de crescer.
    return novo > MAXIMO ? atual : sinal * novo;
  }
  if (tecla === "Backspace" || tecla === "Delete") {
    const novo = Math.trunc(abs / 10);
    // Apagar o último dígito devolve o campo ao vazio, não a "0,00" — assim
    // um campo que pode ficar por preencher (o ajuste manual da fatura) sabe
    // que o usuário o esvaziou de propósito.
    return novo === 0 ? null : sinal * novo;
  }
  return undefined;
}
