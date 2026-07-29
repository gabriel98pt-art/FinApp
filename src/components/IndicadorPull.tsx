import { RefreshCw } from "lucide-react";
import type { EstadoPull } from "../hooks/usePullToRefresh";
import styles from "./IndicadorPull.module.css";

/** Indicador do puxar-para-recarregar: acompanha o dedo, gira conforme o
 *  quanto já se puxou e acende ao passar do limite. Preso no topo, atrás do
 *  conteúdo que desce. */
export default function IndicadorPull({ estado, limite }: { estado: EstadoPull; limite: number }) {
  const { y, armado, recarregando } = estado;
  if (y <= 0 && !recarregando) return null;

  // Uma volta completa ao chegar ao limite — o giro é o progresso, não uma
  // animação em curso.
  const progresso = Math.min(1, y / limite);

  return (
    <div
      className={`${styles.indicador} ${armado ? styles.armado : ""}`}
      style={{
        transform: `translateX(-50%) translateY(${Math.round(y * 0.6)}px)`,
        opacity: Math.min(1, progresso * 1.4),
      }}
      aria-hidden
    >
      <RefreshCw
        size={18}
        className={recarregando ? styles.girando : undefined}
        style={recarregando ? undefined : { transform: `rotate(${progresso * 360}deg)` }}
      />
    </div>
  );
}
