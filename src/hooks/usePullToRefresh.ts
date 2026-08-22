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
//
// Achado da auditoria de Arquitetura & Código: a versão anterior chamava
// `setEstado` (React) a cada evento de `touchmove` do arrasto — a tela
// inteira recalculava dezenas de vezes por segundo enquanto o dedo se movia.
// Agora, como o useDragToClose, o deslocamento/opacidade/rotação são
// escritos DIRETO no DOM a cada frame (bypass do React); o React só entra
// quando algo precisa mudar de verdade — mostrar/esconder o indicador, ou
// começar/acabar o "recarregando".

/** Quanto é preciso puxar para o gesto valer. */
const LIMITE = 76;
/** Teto do esticão. Até ao LIMITE o conteúdo acompanha o dedo 1:1 (como no
 *  iOS) e só o excesso ganha resistência — com rubber-band desde o início,
 *  chegar aos 76px exigiria uns 300px de dedo. */
const MAX = 150;
const RESPOSTA_VOLTA = 0.3;
const AMORT_VOLTA = 1;

export function usePullToRefresh() {
  /** Só o que precisa de re-render: mostrar/esconder o indicador (`visivel`),
   *  a cor de "passou do limite" (`armado`) e o estado de "já soltou acima do
   *  limite" (`recarregando`) — os três mudam só um punhado de vezes por
   *  gesto, não a cada frame. O deslocamento em si (`y`), a opacidade e a
   *  rotação nunca passam pelo React — ver `aplicar`. */
  const [visivel, setVisivel] = useState(false);
  const [armado, setArmado] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  /** Espelhos síncronos, pra `aplicar` ler o valor atual sem esperar o
   *  commit do React (o mesmo motivo do `yRef` abaixo). */
  const recarregandoRef = useRef(false);
  const visivelRef = useRef(false);
  const armadoRef = useRef(false);

  const refConteudo = useRef<HTMLElement | null>(null);
  const refIndicador = useRef<HTMLDivElement | null>(null);
  const refIcone = useRef<SVGSVGElement | null>(null);

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

  /** Escreve o deslocamento atual — o conteúdo desce, o indicador acompanha
   *  e gira. Chamado a cada frame do arrasto e da mola de volta; nenhuma
   *  chamada aqui passa por `setState`. `visivel`/`recarregando` só mudam de
   *  facto (com re-render) nas transições marcadas abaixo. */
  const aplicar = useCallback((y: number) => {
    yRef.current = y;

    if (y > 0 && !visivelRef.current) {
      visivelRef.current = true;
      setVisivel(true);
    } else if (y <= 0 && !recarregandoRef.current && visivelRef.current) {
      visivelRef.current = false;
      setVisivel(false);
    }

    // Passou do limite: soltar agora recarrega, e a cor diz isso. Muda no
    // máximo um punhado de vezes por gesto (cruzar o limiar pra cima, e de
    // volta se o dedo recuar sem soltar) — vale a pena um re-render.
    const armadoAgora = y >= LIMITE;
    if (armadoAgora !== armadoRef.current) {
      armadoRef.current = armadoAgora;
      setArmado(armadoAgora);
    }

    if (refConteudo.current) {
      refConteudo.current.style.transform = y > 0 ? `translateY(${y}px)` : "";
    }

    const progresso = Math.min(1, y / LIMITE);
    const recarregandoAgora = recarregandoRef.current;
    // Enquanto recarrega o conteúdo já voltou ao lugar (y = 0): o indicador
    // fica sozinho, parado na altura do limite.
    const alturaVisivel = recarregandoAgora ? LIMITE : y;
    if (refIndicador.current) {
      refIndicador.current.style.transform = `translateX(-50%) translateY(${Math.round(alturaVisivel * 0.6)}px)`;
      refIndicador.current.style.opacity = String(
        recarregandoAgora ? 1 : Math.min(1, progresso * 1.4),
      );
    }
    if (refIcone.current) {
      // Girando (recarregando) é a animação CSS de `.girando` — um transform
      // inline por cima dela ia competir com o keyframe. Só se escreve a
      // rotação manual fora desse estado.
      if (recarregandoAgora) refIcone.current.style.transform = "";
      else refIcone.current.style.transform = `rotate(${progresso * 360}deg)`;
    }
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
      recarregandoRef.current = true;
      setRecarregando(true);
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
    visivel,
    armado,
    recarregando,
    limite: LIMITE,
    refConteudo,
    refIndicador,
    refIcone,
    manipuladores: {
      onPointerDown: aoPointerDown,
      onPointerMove: aoPointerMove,
      onPointerUp: soltar,
      onPointerCancel: cancelar,
    },
  };
}
