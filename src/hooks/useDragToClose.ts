import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { molaAssentou, passoMola, projetarMomentum, rubberBand } from "../utils/spring";

// Pilha de animação da folha inferior — física de mola real (seção 6), porta
// do financas.html (linhas ~9103-9200).
//
// Este hook começou por servir só o arrasto. Ficava assim: arrastar para
// fechar corria a mola (uns 600 px de percurso, velocidade do dedo, momentum
// projetado), mas ABRIR a folha e fechá-la pelo véu ou pelo Esc corriam uma
// transição CSS de 24 px com fade. A MESMA folha entrava e saía de duas
// maneiras diferentes conforme a pessoa lhe tocasse ou não — e a transição
// CSS, por não ser uma simulação contínua, não se podia agarrar a meio do
// voo.
//
// Agora há um caminho só: abrir, fechar por toque/Esc e fechar por arrasto
// são todos a mesma mola, integrada por rAF, a escrever `--folha-y` no DOM a
// cada frame (bypass do React — é o que permite acompanhar o dedo 1:1 sem lag
// de re-render). Sendo a mesma simulação, qualquer um dos três é interrompível
// e retoma da posição VISÍVEL do momento, sem salto.

/** Resposta (tempo característico, em segundos) da mola de entrada. */
const RESPOSTA_ENTRADA = 0.34;
/** Resposta da mola de saída — sair é mais rápido do que entrar. */
const RESPOSTA_SAIDA = 0.3;
/** Amortecimento crítico: assenta sem passar do alvo. */
const AMORT_CRITICO = 1;
/** Sub-amortecida: passa um pouco do alvo e volta. Só quando o GESTO trouxe
 *  momentum (soltar o arrasto a meio) — abrir por toque não traz nenhum, e um
 *  overshoot num percurso de 700 px descolava a folha da borda de baixo. */
const AMORT_BOUNCE = 0.8;

/** Folga além da borda inferior: a folha tem sombra, e parar exatamente no
 *  limite da janela deixava-a a espreitar. */
const FOLGA = 24;

/** Espera pelo cross-fade de reduced-motion antes de devolver o controlo ao
 *  CSS (--dur-fast é 0,15 s). Só interessa depois de um arrasto, o único caso
 *  em que há posição inline para limpar nesse modo. */
const MS_CROSSFADE = 200;

const reduzido = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Opcoes {
  /** Estado pedido pela aplicação. A folha só sai do DOM lógico (`visivel`)
   *  quando a mola de saída assenta fora da janela. */
  aberta: boolean;
  folhaRef: React.RefObject<HTMLDivElement | null>;
  veuRef: React.RefObject<HTMLDivElement | null>;
  aoFechar: () => void;
}

export function useDragToClose({ aberta, folhaRef, veuRef, aoFechar }: Opcoes) {
  const base = useRef(0);
  const y = useRef(0);
  const sy = useRef(0);
  const hist = useRef<[number, number][]>([]);
  const animId = useRef<number | null>(null);
  const animando = useRef(false);
  const arrastando = useRef(false);

  /** O arrasto já levou a folha para fora: a saída não tem nada a animar. */
  const foraPeloArrasto = useRef(false);

  /** A mola de saída está no ar: a aplicação já fechou a folha, mas ela ainda
   *  está a percorrer o caminho até fora da janela. */
  const [saindo, setSaindo] = useState(false);
  const [eraAberta, setEraAberta] = useState(aberta);

  // Ajuste de estado em RENDER, e não num efeito: quando `aberta` muda temos
  // de decidir na hora se há saída para animar. Um efeito a chamar setState
  // aqui obrigava a um render em cascata — e, pior, a folha chegava a ser
  // pintada uma vez já sem a classe `.presente`, ou seja, o fecho aparecia
  // antes de a mola começar.
  if (aberta !== eraAberta) {
    setEraAberta(aberta);
    setSaindo(!aberta);
  }

  /** A folha está apresentada no ecrã — inclui todo o tempo em que está a
   *  sair. É isto, e não `aberta`, que veste a classe `.presente`. */
  const visivel = aberta || saindo;

  const aplicarY = useCallback(
    (novoY: number) => {
      y.current = novoY;
      const folha = folhaRef.current;
      if (folha) {
        // Uma custom property, e não `style.transform`: a folha compõe o seu
        // transform de formas diferentes (encostada em baixo no telemóvel,
        // centrada como diálogo a partir do tablet). Escrever o transform
        // inteiro daqui destruía a centragem; escrever só o deslocamento
        // deixa o CSS decidir como o compõe.
        folha.style.setProperty("--folha-y", `${novoY}px`);
        folha.dataset.mola = "true";
      }
      const veu = veuRef.current;
      if (veu) {
        // 1 sem deslocamento nenhum, 0 quando a folha já desceu 40% do ecrã. É
        // a opacidade do véu tal e qual: em repouso ele está a 1 (`.veuVisivel`,
        // e o preto já vem meio transparente do `background`), portanto
        // qualquer fator aqui — era `fade * 0.6` — fazia o véu saltar de 1
        // para 0,6 no PRIMEIRO pixel do gesto, um pisca visível antes de
        // começar a desvanecer de facto.
        const fade = Math.max(0, 1 - Math.max(0, novoY) / (window.innerHeight * 0.4));
        veu.style.opacity = fade.toFixed(3);
        veu.dataset.mola = "true";
      }
    },
    [folhaRef, veuRef],
  );

  /** Devolve o repouso ao CSS: tira a posição inline e a marca de "o JS manda
   *  aqui". Só se chama quando a folha já está no sítio certo (assente em 0)
   *  ou já invisível — senão vê-se o salto. */
  const largar = useCallback(() => {
    const folha = folhaRef.current;
    if (folha) {
      folha.style.removeProperty("--folha-y");
      delete folha.dataset.mola;
    }
    const veu = veuRef.current;
    if (veu) {
      veu.style.opacity = "";
      delete veu.dataset.mola;
    }
    y.current = 0;
  }, [folhaRef, veuRef]);

  /** Quantos pixels faltam para a folha sair inteira pela borda de baixo,
   *  medidos a partir da posição ABERTA (descontando o deslocamento que ela
   *  já tenha). Serve tanto para a folha encostada em baixo (= altura dela)
   *  como para o diálogo centrado do desktop. */
  const distanciaFora = useCallback(() => {
    const folha = folhaRef.current;
    if (!folha) return window.innerHeight;
    const topoAberto = folha.getBoundingClientRect().top - y.current;
    return Math.max(0, window.innerHeight - topoAberto) + FOLGA;
  }, [folhaRef]);

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

  /** Entrada: a folha nasce fora da janela e sobe por mola até ao lugar. */
  const entrar = useCallback(() => {
    const folha = folhaRef.current;
    if (!folha) return;
    foraPeloArrasto.current = false;

    if (reduzido()) {
      // Sem deslize: o CSS trata da entrada por opacidade curta.
      pararAnimacao();
      largar();
      return;
    }

    // Se já havia mola no ar (a folha estava a sair e voltaram a abri-la),
    // parte-se da posição VISÍVEL do momento — é isto que torna a abertura
    // interrompível sem salto. Senão, parte-se de fora da janela.
    const noAr = folha.style.getPropertyValue("--folha-y") !== "";
    pararAnimacao();
    aplicarY(noAr ? y.current : distanciaFora());
    animarPara(0, 0, RESPOSTA_ENTRADA, AMORT_CRITICO, largar);
  }, [animarPara, aplicarY, distanciaFora, folhaRef, largar, pararAnimacao]);

  /** Saída por toque no véu, Esc ou qualquer `aoFechar` da aplicação: a MESMA
   *  mola do arrasto, do lugar até fora da janela. */
  const sair = useCallback(() => {
    pararAnimacao();
    if (!folhaRef.current || foraPeloArrasto.current || reduzido()) {
      // Não há percurso nenhum a animar: ou não há nó, ou o arrasto já deixou
      // a folha fora da janela, ou estamos em reduced-motion e ela não desliza
      // de todo — aí quem a esconde é o cross-fade do CSS. Encerrar num
      // microtask e não aqui: setState síncrono dentro de um efeito é render
      // em cascata (e a regra do compilador do React recusa-o).
      queueMicrotask(() => setSaindo(false));
      return;
    }
    animarPara(distanciaFora(), 0, RESPOSTA_SAIDA, AMORT_CRITICO, () => setSaindo(false));
  }, [animarPara, distanciaFora, folhaRef, pararAnimacao]);

  // Efeito de LAYOUT (não `useEffect`): o primeiro `--folha-y` fora da janela
  // tem de ser escrito antes da pintura, senão vê-se um frame com a folha já
  // no lugar.
  useLayoutEffect(() => {
    if (aberta) entrar();
    else if (saindo) sair();
  }, [aberta, saindo, entrar, sair]);

  // Devolver o repouso ao CSS só depois de a folha estar escondida.
  useLayoutEffect(() => {
    if (visivel) return;
    if (!reduzido()) {
      largar();
      return;
    }
    // Em reduced-motion a folha ainda está a desvanecer NO LUGAR; limpar já a
    // posição inline de um arrasto fá-la-ia saltar de volta a meio do fade.
    const t = setTimeout(largar, MS_CROSSFADE);
    return () => clearTimeout(t);
  }, [visivel, largar]);

  // Nunca deixar um rAF pendurado depois de a folha sair do DOM.
  useEffect(() => pararAnimacao, [pararAnimacao]);

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
      folha.dataset.mola = "true";
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

      // velocidade instantânea (px/s) dos últimos ~100ms do gesto — não a
      // média do arrasto inteiro
      const h = hist.current;
      let v = 0;
      if (h.length > 1) {
        const dt = h[h.length - 1][0] - h[0][0];
        if (dt > 0) v = ((h[h.length - 1][1] - h[0][1]) / dt) * 1000;
      }

      const H = folha.offsetHeight;
      const fechar = y.current + projetarMomentum(v) > H / 2;

      if (fechar) {
        animarPara(distanciaFora(), v, RESPOSTA_SAIDA, AMORT_CRITICO, () => {
          // A folha fica onde está — fora da janela. Quem a desmonta é o
          // efeito de saída, que vai reconhecer que não há percurso a fazer.
          foraPeloArrasto.current = true;
          aoFechar();
        });
      } else {
        // Voltar ao lugar: aqui SIM um bounce leve, porque o gesto trouxe
        // momentum. Em reduced-motion, sem bounce.
        animarPara(
          0,
          v,
          reduzido() ? RESPOSTA_SAIDA : RESPOSTA_ENTRADA,
          reduzido() ? AMORT_CRITICO : AMORT_BOUNCE,
          largar,
        );
      }
    },
    [animarPara, aoFechar, distanciaFora, folhaRef, largar],
  );

  return {
    visivel,
    aoPointerDown,
    aoPointerMove,
    aoPointerUp: soltar,
    aoPointerCancel: soltar,
  };
}
