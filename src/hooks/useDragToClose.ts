import { useCallback, useRef } from "react";
import { molaAssentou, passoMola, projetarMomentum, rubberBand } from "../utils/spring";

// Drag-to-close com física de mola real (seção 6) — porta do financas.html
// (linhas ~9103-9200). Só para o gesto de arrastar em si: abrir/fechar sem
// arrasto continua pelos tokens --ease-*/--dur-* do CSS. Escreve
// diretamente no DOM a cada frame (bypass do React) — mesma técnica da
// origem, necessária pra acompanhar o dedo 1:1 sem lag de re-render.

const RESPOSTA_FECHAR = 0.3;
const AMORT_FECHAR = 1; // crítico, sem bounce
const RESPOSTA_ABRIR = 0.34;
const AMORT_ABRIR = 0.8; // bounce leve — o gesto trouxe momentum

interface Opcoes {
  folhaRef: React.RefObject<HTMLDivElement | null>;
  veuRef: React.RefObject<HTMLDivElement | null>;
  aoFechar: () => void;
}

export function useDragToClose({ folhaRef, veuRef, aoFechar }: Opcoes) {
  const base = useRef(0);
  const y = useRef(0);
  const sy = useRef(0);
  const hist = useRef<[number, number][]>([]);
  const animId = useRef<number | null>(null);
  const animando = useRef(false);
  const arrastando = useRef(false);

  const aplicarY = useCallback(
    (novoY: number) => {
      y.current = novoY;
      const folha = folhaRef.current;
      if (folha) folha.style.transform = `translateX(-50%) translateY(${novoY}px)`;
      const veu = veuRef.current;
      if (veu) {
        const fade = Math.max(0, 1 - Math.max(0, novoY) / (window.innerHeight * 0.4));
        veu.style.opacity = (fade * 0.6).toFixed(3);
      }
    },
    [folhaRef, veuRef],
  );

  const pararAnimacao = useCallback(() => {
    if (animId.current !== null) cancelAnimationFrame(animId.current);
    animId.current = null;
    animando.current = false;
  }, []);

  const animarPara = useCallback(
    (to: number, v0: number, response: number, damping: number, aoTerminar: () => void) => {
      let estado = { x: y.current, v: v0 };
      let ultimo: number | null = null;
      animando.current = true;
      const passo = (agora: number) => {
        if (ultimo === null) ultimo = agora;
        const dt = Math.min(0.032, (agora - ultimo) / 1000);
        ultimo = agora;
        estado = passoMola(estado, to, response, damping, dt);
        if (molaAssentou(estado, to)) {
          aplicarY(to);
          animando.current = false;
          animId.current = null;
          aoTerminar();
          return;
        }
        aplicarY(estado.x);
        animId.current = requestAnimationFrame(passo);
      };
      animId.current = requestAnimationFrame(passo);
    },
    [aplicarY],
  );

  const aoPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const folha = folhaRef.current;
      if (!folha) return;
      if (animando.current) {
        // agarrar a meio do voo: pára a mola e retoma da posição visível
        // atual, sem salto
        pararAnimacao();
        base.current = y.current;
      } else {
        base.current = 0;
      }
      sy.current = e.clientY;
      y.current = base.current;
      hist.current = [[performance.now(), base.current]];
      arrastando.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      folha.dataset.dragging = "true";
    },
    [folhaRef, pararAnimacao],
  );

  const aoPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!arrastando.current) return;
      const folha = folhaRef.current;
      let novoY = base.current + (e.clientY - sy.current);
      if (novoY < 0) novoY = -rubberBand(-novoY, folha?.offsetHeight ?? 0);
      aplicarY(novoY);
      const agora = performance.now();
      hist.current.push([agora, novoY]);
      while (hist.current.length > 2 && agora - hist.current[0][0] > 100) hist.current.shift();
    },
    [aplicarY, folhaRef],
  );

  const soltar = useCallback(
    (e: React.PointerEvent) => {
      if (!arrastando.current) return;
      arrastando.current = false;
      const folha = folhaRef.current;
      if (!folha) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      delete folha.dataset.dragging;

      // velocidade instantânea (px/s) dos últimos ~100ms do gesto — não a
      // média do arrasto inteiro
      const h = hist.current;
      let v = 0;
      if (h.length > 1) {
        const dt = h[h.length - 1][0] - h[0][0];
        if (dt > 0) v = ((h[h.length - 1][1] - h[0][1]) / dt) * 1000;
      }

      const H = folha.offsetHeight;
      const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const fechar = y.current + projetarMomentum(v) > H / 2;

      const limpar = () => {
        folha.style.transform = "";
        const veu = veuRef.current;
        if (veu) veu.style.opacity = "";
      };

      if (fechar) {
        animarPara(H + 24, v, RESPOSTA_FECHAR, AMORT_FECHAR, () => {
          limpar();
          aoFechar();
        });
      } else {
        animarPara(
          0,
          v,
          reduzido ? RESPOSTA_FECHAR : RESPOSTA_ABRIR,
          reduzido ? AMORT_FECHAR : AMORT_ABRIR,
          limpar,
        );
      }
    },
    [animarPara, aoFechar, folhaRef, veuRef],
  );

  return {
    aoPointerDown,
    aoPointerMove,
    aoPointerUp: soltar,
    aoPointerCancel: soltar,
  };
}
