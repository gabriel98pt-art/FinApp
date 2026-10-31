// Perfil da pessoa: nome opcional, foto pequena e iniciais do avatar. Funções
// puras — a validação de `normalizarConfig` e o avatar usam as mesmas regras.

/** Tamanho máximo do nome. */
export const NOME_MAX = 40;

/** Tamanho máximo da foto, em caracteres do data URL: ~30 KB de imagem em
 *  base64 (×4/3) mais o prefixo, com folga. */
export const FOTO_MAX_CHARS = 42_000;

const PREFIXO_FOTO = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/** Nome pronto a guardar: texto, sem espaços nas pontas nem repetidos, no
 *  máximo `NOME_MAX`. Qualquer outra coisa vira "" (sem nome). */
export function nomeLimpo(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, NOME_MAX);
}

/** A foto é um data URL JPEG/WebP de tamanho razoável? Não confia no que veio
 *  da base: rejeita outros tipos (SVG pode levar script), outros prefixos e
 *  textos grandes demais. */
export function fotoValida(v: unknown): boolean {
  return typeof v === "string" && v.length <= FOTO_MAX_CHARS && PREFIXO_FOTO.test(v);
}

/** Iniciais do avatar: 1.ª letra da 1.ª e da última palavra do nome (maiúsculas,
 *  com acentos mantidos — «Álvaro Éder» → «ÁÉ»); com uma só palavra, só uma
 *  letra; sem nome, a 1.ª letra do e-mail; sem nada, «?». */
export function iniciaisDe(nome: string | null | undefined, email?: string | null): string {
  const palavras = nomeLimpo(nome ?? "")
    .split(" ")
    .filter(Boolean);
  const letra = (p: string) => (Array.from(p)[0] ?? "").toLocaleUpperCase("pt-PT");
  if (palavras.length >= 2) return letra(palavras[0]) + letra(palavras[palavras.length - 1]);
  if (palavras.length === 1) return letra(palavras[0]);
  const e = (email ?? "").trim();
  return e ? letra(e) : "?";
}
