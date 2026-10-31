// Redução da foto de perfil no próprio aparelho (sem Firebase Storage): o
// ficheiro escolhido vira um quadrado ~200×200 em WebP/JPEG que cabe em ~30 KB e
// guarda-se como data URL junto com os dados da conta.

import { FOTO_MAX_CHARS, fotoValida } from "./perfil";

/** Lado do quadrado final. */
export const LADO_FOTO = 200;
/** Peso máximo da imagem final, em bytes. */
export const FOTO_MAX_BYTES = 30 * 1024;
/** Ficheiro de origem: aceita-se mais do que se guarda, porque é reduzido. */
export const ORIGEM_MAX_BYTES = 15 * 1024 * 1024;
export const TIPOS_ORIGEM = ["image/jpeg", "image/png", "image/webp"];

/** Erro de validação do ficheiro escolhido (texto para o utilizador), ou null. */
export function erroDoFicheiro(f: { type: string; size: number }): string | null {
  if (!TIPOS_ORIGEM.includes(f.type)) return "Escolha uma imagem JPEG, PNG ou WebP.";
  if (f.size > ORIGEM_MAX_BYTES) return "A imagem é grande demais (máximo 15 MB).";
  if (f.size === 0) return "O ficheiro está vazio.";
  return null;
}

/** O recorte quadrado central (cobre o quadrado, sem deformar). */
export function recorteQuadrado(largura: number, altura: number) {
  const lado = Math.min(largura, altura);
  return { sx: (largura - lado) / 2, sy: (altura - lado) / 2, lado };
}

/** Tamanho aproximado, em bytes, da imagem dentro de um data URL. */
export function bytesDoDataUrl(url: string): number {
  const i = url.indexOf(",");
  const b64 = i >= 0 ? url.slice(i + 1) : url;
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Tenta qualidades decrescentes até a imagem caber em `maxBytes`. `codificar`
 *  devolve um data URL para uma qualidade (0–1). Devolve o primeiro que cabe,
 *  ou null se nem a mais baixa couber. */
export async function comprimirAteCaber(
  codificar: (qualidade: number) => Promise<string>,
  qualidades: number[],
  maxBytes: number,
): Promise<string | null> {
  for (const q of qualidades) {
    const url = await codificar(q);
    if (bytesDoDataUrl(url) <= maxBytes) return url;
  }
  return null;
}

const QUALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25];

function paraDataUrl(canvas: HTMLCanvasElement, tipo: string, q: number): string {
  return canvas.toDataURL(tipo, q);
}

/** Reduz uma imagem escolhida para a foto de perfil. Lança Error com texto
 *  para o utilizador se o ficheiro não servir. */
export async function reduzirImagem(ficheiro: File): Promise<string> {
  const erro = erroDoFicheiro(ficheiro);
  if (erro) throw new Error(erro);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(ficheiro);
  } catch {
    throw new Error("Não foi possível ler a imagem.");
  }
  const { sx, sy, lado } = recorteQuadrado(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LADO_FOTO;
  canvas.height = LADO_FOTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  bitmap.close?.();

  // WebP primeiro; se o navegador não o codifica (devolve PNG), JPEG.
  const webp = paraDataUrl(canvas, "image/webp", 0.8);
  const tipo = webp.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  const url = await comprimirAteCaber(
    (q) => Promise.resolve(paraDataUrl(canvas, tipo, q)),
    QUALIDADES,
    FOTO_MAX_BYTES,
  );
  if (!url || !fotoValida(url) || url.length > FOTO_MAX_CHARS) {
    throw new Error("Não foi possível reduzir a imagem o suficiente.");
  }
  return url;
}
