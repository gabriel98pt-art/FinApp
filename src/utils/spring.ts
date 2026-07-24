// Física de mola real, à Apple ("Designing Fluid Interfaces") — portada do
// financas.html (linhas ~9103-9130). Funções puras: quem integra por rAF e
// mede o gesto é o hook useDragToClose; aqui só a matemática, testável sem
// DOM.

export interface EstadoMola {
  x: number;
  v: number;
}

/** Um passo de integração Euler semi-implícito da mola amortecida — estável
 *  a 60/120Hz. w0 = 2π/response: response é o "tempo característico" da
 *  mola, não uma duração fixa; damping (0-1) controla o bounce (1 = crítico,
 *  sem overshoot). */
export function passoMola(
  estado: EstadoMola,
  to: number,
  response: number,
  damping: number,
  dt: number,
): EstadoMola {
  const w0 = (2 * Math.PI) / response;
  const v = estado.v + (-w0 * w0 * (estado.x - to) - 2 * damping * w0 * estado.v) * dt;
  const x = estado.x + v * dt;
  return { x, v };
}

/** A mola "assentou": perto o bastante do alvo e quase parada — critério de
 *  parada da integração (mesmos limiares da origem: 0.5px, 20px/s). */
export function molaAssentou(estado: EstadoMola, to: number): boolean {
  return Math.abs(estado.x - to) < 0.5 && Math.abs(estado.v) < 20;
}

/** Projeção de momentum: onde o gesto pararia por inércia se soltássemos o
 *  dedo agora, por decaimento exponencial (d=0.998 ≈ scroll natural) — não
 *  a fórmula cinemática v²/2a. Decide o destino do snap, não só a posição
 *  do dedo ao soltar. */
export function projetarMomentum(v: number): number {
  return ((v / 1000) * 0.998) / (1 - 0.998);
}

/** Rubber-band: resistência progressiva ao puxar além do limite (ex. acima
 *  do topo da folha) — quanto mais se puxa, menos ela cede. */
export function rubberBand(over: number, dim: number): number {
  return (over * dim * 0.55) / (dim + 0.55 * over);
}
