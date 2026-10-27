// Geometria dos gráficos SVG da Análise (não há biblioteca de gráficos, de
// propósito): funções puras, para testar sem desenhar nada.

export interface Ponto {
  x: number;
  y: number;
}

/** Curva suave a passar por todos os pontos (Catmull-Rom convertida em
 *  Bézier). O `y` dos pontos de controlo fica entre o dos vizinhos: sem isto a
 *  curva passava abaixo de zero ou acima do máximo ao virar. `M…` com um ponto
 *  só, vazio sem pontos. */
export function caminhoSuave(pontos: Ponto[]): string {
  if (pontos.length === 0) return "";
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M${f(pontos[0].x)} ${f(pontos[0].y)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const alto = Math.min(p1.y, p2.y);
    const baixo = Math.max(p1.y, p2.y);
    const limita = (y: number) => Math.max(alto, Math.min(baixo, y));
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: limita(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: limita(p2.y - (p3.y - p1.y) / 6) };
    d += ` C${f(c1.x)} ${f(c1.y)},${f(c2.x)} ${f(c2.y)},${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** Os pontos de uma série num retângulo `largura × altura`, com `0` em baixo e
 *  `max` em cima. Com um valor só, o ponto fica a meio. */
export function pontosDaSerie(
  valores: number[],
  max: number,
  largura: number,
  altura: number,
): Ponto[] {
  const topo = max > 0 ? max : 1;
  return valores.map((v, i) => ({
    x: valores.length === 1 ? largura / 2 : (i / (valores.length - 1)) * largura,
    y: altura - (Math.max(0, v) / topo) * altura,
  }));
}

/** O teto da escala: o maior valor com uma folga, para a linha não encostar ao
 *  topo. 1 quando tudo é zero (a escala não pode ser nula). */
export function tetoDaEscala(...series: number[][]): number {
  const maior = Math.max(0, ...series.flat());
  return maior === 0 ? 1 : Math.ceil(maior * 1.08);
}
