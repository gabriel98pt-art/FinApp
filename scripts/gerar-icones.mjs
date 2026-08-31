// Gera os PNG do ícone e as imagens do ecrã de arranque a partir do desenho
// único que existe no repositório: `public/icons/icon-v4.svg`.
//
// Porque é que isto é um script e não ficheiros gerados à mão: o desenho muda
// (já vai na versão 4) e cada mudança obrigaria a reexportar cinco imagens em
// tamanhos diferentes sem enganos. Aqui há UMA fonte — o SVG — e tudo o resto
// é derivado dela. Trocar o desenho é trocar o SVG e correr `npm run icones`.
//
// Não há nenhum conversor de SVG→PNG instalado no sistema (nem `rsvg-convert`,
// nem ImageMagick, nem Inkscape), por isso a conversão é feita pelo `sharp`,
// que traz o rasterizador (librsvg) dentro do próprio pacote npm e portanto
// funciona igual em qualquer máquina onde o `npm install` corra.

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const pastaIcones = join(raiz, "public", "icons");
const pastaSplash = join(raiz, "public", "splash");

const VERSAO = "v4";
const ORIGEM = join(pastaIcones, `icon-${VERSAO}.svg`);

// O desenho é quadrado de 512×512 (o `viewBox` do SVG). A densidade de
// rasterização é calculada a partir daí para que o SVG seja desenhado já no
// tamanho final, em vez de ser desenhado pequeno e depois esticado (que borra
// as linhas finas do "APP" em baixo).
const LADO_SVG = 512;
const densidadePara = (lado) => Math.ceil((72 * lado) / LADO_SVG);

// As cores vêm de `src/styles/tokens.css` — são os mesmos tokens que a app usa
// em cada tema, para que o ecrã de arranque e a primeira tela tenham
// exactamente o mesmo fundo (sem o piscar de claro-para-escuro no arranque).
const TEMAS = {
  escuro: {
    fundo: "#0A1622", // --bg
    traco: "#EAF1F7", // --txt
    azul: "#5FA6FC", // --blu
    verde: "#4ADE80", // --grn
  },
  claro: {
    fundo: "#F5F7FA", // --bg  [data-theme="light"]
    traco: "#0A2540", // --txt
    azul: "#0F5DBD", // --blu
    verde: "#15803D", // --grn
  },
};

const svgOriginal = readFileSync(ORIGEM, "utf8");

/** O desenho sem a chapa de fundo — só a marca, com fundo transparente.
 *  Usado no ecrã de arranque, onde o fundo é a cor do tema e não uma chapa. */
function marcaSemChapa(tema) {
  let svg = svgOriginal.replace(/\s*<rect[^>]*\/>\s*/, "\n  ");
  if (tema === TEMAS.escuro) return svg;
  // O tema claro não é um "inverter cores": cada cor da marca troca pelo token
  // equivalente do tema claro, que já foi escolhido para contrastar com fundo
  // branco (ver o bloco [data-theme="light"] em tokens.css).
  for (const [de, para] of [
    [TEMAS.escuro.traco, tema.traco],
    [TEMAS.escuro.azul, tema.azul],
    [TEMAS.escuro.verde, tema.verde],
  ]) {
    svg = svg.replaceAll(de, para);
  }
  return svg;
}

async function gerarIcone(lado, destino, { semTransparencia = false } = {}) {
  let img = sharp(Buffer.from(svgOriginal), { density: densidadePara(lado) })
    .resize(lado, lado)
    .toColorspace("srgb");

  if (semTransparencia) {
    // Regra da App Store: o ícone de 1024 px não pode ter canal alpha nenhum
    // (nem sequer todo opaco) — a Apple rejeita o envio. `flatten` assenta a
    // imagem sobre a cor de fundo e deita o canal fora; `removeAlpha` garante
    // que o PNG sai com 3 canais mesmo que o `flatten` não tenha nada que
    // fazer. O ícone também sai quadrado e sem cantos redondos de propósito:
    // é o iOS que aplica a sua própria máscara por cima.
    img = img.flatten({ background: TEMAS.escuro.fundo }).removeAlpha();
  }

  await img.png({ compressionLevel: 9 }).toFile(destino);
  const meta = await sharp(destino).metadata();
  console.log(
    `  ${destino.replace(raiz + "/", "")} — ${meta.width}×${meta.height}, ` +
      `${meta.channels} canais, alpha: ${meta.hasAlpha ? "SIM" : "não"}`,
  );
}

// 2732×2732 é o formato "universal" do ecrã de arranque: o sistema recorta o
// centro desta imagem para o tamanho do ecrã do aparelho, seja qual for. Por
// isso a marca fica pequena e bem no meio — o que estiver longe do centro é
// cortado num telemóvel estreito.
const LADO_SPLASH = 2732;
const LADO_MARCA = 620;

async function gerarSplash(tema, destino) {
  const marca = await sharp(Buffer.from(marcaSemChapa(tema)), {
    density: densidadePara(LADO_MARCA),
  })
    .resize(LADO_MARCA, LADO_MARCA)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: LADO_SPLASH,
      height: LADO_SPLASH,
      channels: 3,
      background: tema.fundo,
    },
  })
    .composite([{ input: marca, gravity: "centre" }])
    .toColorspace("srgb")
    .png({ compressionLevel: 9 })
    .toFile(destino);

  console.log(`  ${destino.replace(raiz + "/", "")} — ${LADO_SPLASH}×${LADO_SPLASH}`);
}

mkdirSync(pastaIcones, { recursive: true });
mkdirSync(pastaSplash, { recursive: true });

console.log(`Ícones (a partir de ${ORIGEM.replace(raiz + "/", "")}):`);
await gerarIcone(192, join(pastaIcones, `icon-192-${VERSAO}.png`));
await gerarIcone(512, join(pastaIcones, `icon-512-${VERSAO}.png`));
await gerarIcone(180, join(pastaIcones, `apple-touch-icon-${VERSAO}.png`), {
  semTransparencia: true,
});
await gerarIcone(1024, join(pastaIcones, `icon-1024-${VERSAO}.png`), {
  semTransparencia: true,
});

console.log("Ecrã de arranque:");
await gerarSplash(TEMAS.escuro, join(pastaSplash, `splash-escuro-${VERSAO}.png`));
await gerarSplash(TEMAS.claro, join(pastaSplash, `splash-claro-${VERSAO}.png`));
