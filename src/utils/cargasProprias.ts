/** As cargas que saem do bolso do próprio: tira as recargas da frota (paga pela
 *  frota, do relatório do dono — ficam registadas, mas não são gasto). Ficheiro
 *  à parte para qualquer util o poder importar sem ciclos. */
export function cargasProprias<T extends { frota?: boolean }>(cargas: T[]): T[] {
  return cargas.filter((c) => !c.frota);
}
