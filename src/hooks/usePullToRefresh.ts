import { useCallback, useRef, useState } from "react";
import { molaAssentou, passoMola, rubberBand } from "../utils/spring";
import { checarVersaoNova } from "../stores/pwaStore";

// Puxar do topo para recarregar — reforço manual do usePwaUpdate, para quando
// se quer forçar em vez de esperar. Mesmo espírito do useDragToClose: Pointer
// Events e a física de `utils/spring.ts`, sem biblioteca nova.
//
// Recarregar a página NÃO obriga o navegador a procurar versão nova — foi
// exatamente essa suposição que deixou o app preso na versão velha e deu origem
// ao usePwaUpdate. Aqui pede-se a checagem à mão pelo mesmo caminho já provado
// (`checarVersaoNova`); só se recarrega quando já se estava na última versão.

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
  /** Histórico de (tempo, y) dos últimos ~100ms do gesto — mesma janela do
   *  useDragToClose, pra calcular velocidade INSTANTÂNEA no solto, não a
   *  média do puxão inteiro. Sem isto a mola de volta sempre partia de v=0,
   *  parecendo travar em seco antes de recuar — mesmo num puxão rápido
   *  largado ainda em movimento (achado da auditoria de Design). */
  const hist = useRef<[number, number][]>([]);

  const aplicar = useCallback((y: number) => {
    yRef.current = y;
    setEstado((e) => ({ ...e, y, armado: y >= LIMITE }));
  }, []);

  const voltar = useCallback(
    (v0 = 0) => {
      const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduzido) {
        aplicar(0);
        return;
      }
      let m = { x: yRef.current, v: v0 };
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
    },
    [aplicar],
  );

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
    hist.current = [[performance.now(), 0]];
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
      const y = delta <= LIMITE ? delta : LIMITE + rubberBand(delta - LIMITE, MAX - LIMITE);
      aplicar(y);
      const agora = performance.now();
      hist.current.push([agora, y]);
      while (hist.current.length > 2 && agora - hist.current[0][0] > 100) hist.current.shift();
    },
    [aplicar],
  );

  /** Velocidade instantânea (px/s) da janela recente do histórico — mesma
   *  conta do useDragToClose. */
  const velocidadeAtual = useCallback(() => {
    const h = hist.current;
    if (h.length < 2) return 0;
    const dt = h[h.length - 1][0] - h[0][0];
    return dt > 0 ? ((h[h.length - 1][1] - h[0][1]) / dt) * 1000 : 0;
  }, []);

  /** Havendo versão nova, quem aplica e recarrega é o usePwaUpdate — não há um
   *  segundo caminho de atualização aqui. O reload é só o desfecho de "já
   *  estavas na última", para o gesto não parecer que não fez nada. */
  const atualizar = useCallback(async () => {
    if (await checarVersaoNova()) return;
    window.location.reload();
  }, []);

  const soltar = useCallback(() => {
    if (!puxando.current) return;
    puxando.current = false;
    const v = velocidadeAtual();
    if (yRef.current >= LIMITE) {
      setEstado((e) => ({ ...e, recarregando: true }));
      // A checagem demora — o conteúdo volta ao lugar e fica só o indicador a
      // girar, em vez de a tela ficar presa a meio do puxão.
      voltar(v);
      void atualizar();
      return;
    }
    voltar(v);
  }, [voltar, atualizar, velocidadeAtual]);

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
