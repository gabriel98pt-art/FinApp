/** Identificador único de qualquer entidade. No app antigo era um contador
 *  sequencial numérico (`_id`); aqui é sempre string (ids legados viram string
 *  na importação). */
export type Id = string;

/** Valor monetário em centavos inteiros — nunca float (seção 4.2). */
export type Cents = number;

/** Data no formato 'YYYY-MM-DD' (evita parsing de Date/timezone). */
export type IsoDate = string;

/** Mês no formato 'YYYY-MM'. */
export type YearMonth = string;

export type Currency = "EUR" | "BRL" | "USD" | "GBP";

export type Theme = "dark" | "light";
