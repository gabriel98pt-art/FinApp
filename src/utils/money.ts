// Aritmética monetária (seção 4.2): todo valor vira centavos inteiros antes
// de somar — nunca somar floats. Funções puras, sem dependência de DOM/Firebase.

import type { Cents, Currency } from "../types";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  BRL: "R$",
  USD: "$",
  GBP: "£",
};

/** Converte um número em euros/reais/... para centavos inteiros. */
export function toCents(valor: number): Cents {
  return Math.round(valor * 100);
}

/** Converte centavos inteiros de volta para unidades (só para exibição/IO). */
export function fromCents(cents: Cents): number {
  return cents / 100;
}

/**
 * Interpreta um valor digitado e devolve centavos, ou `null` se ilegível.
 *
 * Regras (comportamento do app de referência, seção 4.2):
 * - formato português `1.234,56` e americano `1,234.56`;
 * - notação contábil negativa entre parênteses: `(1234,56)` → -1234,56;
 * - tolera símbolos de moeda colados ao número (€, $, £, R$) e espaços;
 * - com os dois separadores presentes, o que aparece por último é o decimal;
 * - só vírgula → decimal (prioridade pt); só ponto seguido de exatamente
 *   3 dígitos → milhar pt (`1.234` = 1234), caso contrário decimal (`0.50`).
 */
export function parseMoney(input: string): Cents | null {
  let s = input.trim();
  if (s === "") return null;

  // Símbolos de moeda e espaços (inclui NBSP) colados ao número
  s = s.replace(/R\$|[€$£]/g, "").replace(/\s/g, "");

  // Notação contábil: (123,45) → negativo
  let negative = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1];
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s === "" || /[^0-9.,]/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep: "." | "," | null = null;

  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma !== -1) {
    // Só vírgula: decimal, a não ser que apareça várias vezes (milhar en)
    decimalSep = s.indexOf(",") === lastComma ? "," : null;
  } else if (lastDot !== -1) {
    // Só ponto: `1.234` é milhar pt; `0.50`/`12.5` é decimal en
    const digitsAfter = s.length - lastDot - 1;
    const onlyOnce = s.indexOf(".") === lastDot;
    decimalSep = onlyOnce && digitsAfter !== 3 ? "." : null;
  }

  let intPart = s;
  let fracPart = "";
  if (decimalSep !== null) {
    const idx = decimalSep === "." ? lastDot : lastComma;
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
    if (fracPart.length === 0 || /[.,]/.test(fracPart)) return null;
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (intPart === "" && fracPart === "") return null;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;

  const units = intPart === "" ? 0 : parseInt(intPart, 10);
  // Fração truncada/arredondada a centavos: '5' → 50, '567' → 57
  const fracCents =
    fracPart === ""
      ? 0
      : Math.round(
          parseInt(fracPart.padEnd(2, "0"), 10) / 10 ** (Math.max(fracPart.length, 2) - 2),
        );

  const cents = units * 100 + fracCents;
  return negative ? -cents : cents;
}

/** Formata centavos no padrão `1.234,56` — o mesmo para todas as moedas
 *  suportadas (seção 4.5: só o símbolo muda, não a formatação regional). */
export function formatCents(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, "0");
  const withThousands = units.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${withThousands},${frac}`;
}

/** `formatCents` com o símbolo da moeda da conta antes do número. */
export function formatMoney(cents: Cents, currency: Currency): string {
  return `${CURRENCY_SYMBOLS[currency]} ${formatCents(cents)}`;
}
