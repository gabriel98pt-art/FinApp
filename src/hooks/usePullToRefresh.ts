import { useCallback, useRef, useState } from "react";
import { molaAssentou, passoMola, rubberBand } from "../utils/spring";

// Puxar do topo para recarregar — reforço manual do usePwaUpdate, para quando
// se quer forçar em vez de esperar. Mesmo espírito do useDragToClose: Pointer
// Events e a física de `utils/spring.ts`, sem biblioteca nova.
//
// Um reload de verdade basta: o navegador reavalia o service worker nesse
// caminho, então não há lógica de atualização duplicada aqui.

/** Quanto é preciso puxar para o gesto valer. */
const LIMITE = 76;
/** Teto do esticão. Até ao LIMITE o conteúdo acompanha o dedo 1:1 (como no
 *  iOS) e só o excesso ganha resistência — com rubber-band desde o início,
 *  chegar aos 76px exigiria uns 300px de dedo. */
const MAX = 150;
const RESPOSTA_VOLTA = 0.3;
const AMORT_VOLTA = 1;

export interface EstadoPull {
  /** Deslocamento atual em px (0 = nada puxado). */
  y: number;
  /** Passou do limite: soltar agora recarrega. */
  armado: boolean;
  /** Já soltou acima do limite e está a recarregar. */
  recarregando: boolean;
}

export function usePullToRefresh() {
  const [estado, setEstado] = useState<EstadoPull>({
    y: 0,
    armado: false,
    recarregando: false,
  });

  const inicioY = useRef(0);
  const puxando = useRef(false);
  const animId = useRef<number | null>(null);
  const yRef = useRef(0);

  const aplicar = useCallback((y: number) => {
    yRef.current = y;
    setEstado((e) => ({ ...e, y, armado: y >= LIMITE }));
  }, []);

  const voltar = useCallback(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      aplicar(0);
      return;
    }
    let m = { x: yRef.current, v: 0 };
    let ultimo: number | null = null;
    const passo = (agora: number) => {
      if (ultimo === null) ultimo = agora;
      const dt = Math.min(0.032, (agora - ultimo) / 1000);
      ultimo = agora;
      m = passoMola(m, 0, RESPOSTA_VOLTA, AMORT_VOLTA, dt);
      if (molaAssentou(m, 0)) {
        aplicar(0);
        animId.current = null;
        return;
      }
      aplicar(m.x);
      animId.current = requestAnimationFrame(passo);
    };
    animId.current = requestAnimationFrame(passo);
  }, [aplicar]);

  const aoPointerDown = useCallback((e: React.PointerEvent) => {
    // Só com toque, e só quando a página já está no topo — no meio da lista
    // isto seria scroll, não puxão.
    if (e.pointerType === "mouse") return;
    if (window.scrollY > 0) return;
    if (animId.current !== null) {
      cancelAnimationFrame(animId.current);
      animId.current = null;
    }
    inicioY.current = e.clientY;
    puxando.current = true;
  }, []);

  const aoPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!puxando.current) return;
      const delta = e.clientY - inicioY.current;
      // Para cima é scroll normal: larga o gesto e não interfere.
      if (delta <= 0) {
        if (yRef.current !== 0) aplicar(0);
        puxando.current = false;
        return;
      }
      // Rolou entretanto (dedo desceu mas a página não estava no topo).
      if (window.scrollY > 0) {
        puxando.current = false;
        if (yRef.current !== 0) aplicar(0);
        return;
      }
      aplicar(delta <= LIMITE ? delta : LIMITE + rubberBand(delta - LIMITE, MAX - LIMITE));
    },
    [aplicar],
  );

  const soltar = useCallback(() => {
    if (!puxando.current) return;
    puxando.current = false;
    if (yRef.current >= LIMITE) {
      setEstado((e) => ({ ...e, recarregando: true }));
      window.location.reload();
      return;
    }
    voltar();
  }, [voltar]);

  /** `pointercancel` é o sistema a tomar conta do gesto (virou scroll, o dedo
   *  saiu do ecrã…), não uma confirmação — recarregar aqui seria recarregar
   *  sem o usuário ter soltado por vontade própria. */
  const cancelar = useCallback(() => {
    if (!puxando.current) return;
    puxando.current = false;
    voltar();
  }, [voltar]);

  return {
    estado,
    limite: LIMITE,
    manipuladores: {
      onPointerDown: aoPointerDown,
      onPointerMove: aoPointerMove,
      onPointerUp: soltar,
      onPointerCancel: cancelar,
    },
  };
}
