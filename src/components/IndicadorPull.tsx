import { RefreshCw } from "lucide-react";
import type { RefObject } from "react";
import styles from "./IndicadorPull.module.css";

/** Indicador do puxar-para-recarregar: acompanha o dedo, gira conforme o
 *  quanto já se puxou e acende ao passar do limite. Preso no topo, atrás do
 *  conteúdo que desce.
 *
 *  Posição, opacidade e rotação são escritas direto nos nós (`refIndicador`/
 *  `refIcone`) por `usePullToRefresh` a cada frame do arrasto — não são
 *  props porque mudam rápido demais pra passar pelo React a cada uma
 *  (achado da auditoria de Arquitetura & Código). `visivel`/`armado`/
 *  `recarregando` continuam props normais: mudam só nas transições. */
export default function IndicadorPull({
  visivel,
  armado,
  recarregando,
  refIndicador,
  refIcone,
}: {
  visivel: boolean;
  armado: boolean;
  recarregando: boolean;
  refIndicador: RefObject<HTMLDivElement | null>;
  refIcone: RefObject<SVGSVGElement | null>;
}) {
  if (!visivel && !recarregando) return null;

  return (
    <div
      ref={refIndicador}
      className={`${styles.indicador} ${armado ? styles.armado : ""}`}
      aria-hidden
    >
      <RefreshCw ref={refIcone} size={18} className={recarregando ? styles.girando : undefined} />
    </div>
  );
}
