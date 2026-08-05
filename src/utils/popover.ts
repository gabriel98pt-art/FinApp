// Geometria do popover ancorado (ver components/Popover.tsx). Função pura: só
// contas com retângulos, sem DOM — é o que decide se a caixa abre por baixo ou
// por cima do gatilho e quanto pode crescer.

/** Respiro mínimo até à borda da janela — a caixa nunca encosta. */
export const MARGEM = 8;
/** Distância entre o gatilho e a caixa, para o gatilho continuar a ler-se. */
export const ESPACO = 6;
/** Abaixo disto não vale a pena abrir para o lado que sobrou: cabe menos de
 *  duas opções e a lista fica a rolar num vão. */
export const ALTURA_MINIMA = 120;

export interface Retangulo {
  top: number;
  left: number;
  bottom: number;
  width: number;
}

export interface PosicaoPopover {
  top: number;
  left: number;
  maxAltura: number;
  /** Para onde abriu. Só informativo — quem posiciona é o `top`. */
  acima: boolean;
}

/** Onde pôr a caixa: por baixo do gatilho por omissão, por cima quando não
 *  cabe em baixo e sobra mais espaço em cima — a mesma decisão que um
 *  `<select>` nativo toma sozinho. Nunca deixa a caixa sair da janela. */
export function posicionarPopover(
  /** Retângulo do gatilho, em coordenadas da janela. */
  ancora: Retangulo,
  /** Tamanho natural da caixa, medido antes de ser posicionada. */
  caixa: { largura: number; altura: number },
  janela: { largura: number; altura: number },
): PosicaoPopover {
  const espacoAbaixo = janela.altura - ancora.bottom - ESPACO - MARGEM;
  const espacoAcima = ancora.top - ESPACO - MARGEM;
  const acima = caixa.altura > espacoAbaixo && espacoAcima > espacoAbaixo;

  const maxAltura = Math.max(ALTURA_MINIMA, acima ? espacoAcima : espacoAbaixo);
  const top = acima
    ? Math.max(MARGEM, ancora.top - ESPACO - Math.min(caixa.altura, maxAltura))
    : ancora.bottom + ESPACO;

  // Alinha pela esquerda do gatilho e puxa para dentro se transbordar à
  // direita. O `max` no fim ganha sempre, para uma caixa mais larga do que a
  // janela começar na margem em vez de num valor negativo.
  const left = Math.max(MARGEM, Math.min(ancora.left, janela.largura - caixa.largura - MARGEM));

  return { top, left, maxAltura, acima };
}
