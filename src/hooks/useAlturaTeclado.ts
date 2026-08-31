import { useEffect } from "react";

/** Abaixo disto não é teclado. No Safari do iPhone a barra de endereço encolhe
 *  e cresce ao rolar, e isso também mexe na janela visual — sem um mínimo, a
 *  folha dava um salto de ~50px sempre que a pessoa rolava a página. Nenhum
 *  teclado de telemóvel é mais baixo do que isto. */
const MINIMO_TECLADO = 120;

function medir() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  // A "janela visual" é o que sobra à vista depois do teclado; a janela normal
  // (innerHeight) continua a ser o ecrã inteiro, e é a ela que o `bottom` de
  // um elemento `position: fixed` se refere. O teclado ocupa daí para baixo:
  // do fundo da janela visual (offsetTop + height) até ao fundo do ecrã.
  const tapado = window.innerHeight - vv.height - vv.offsetTop;
  return tapado > MINIMO_TECLADO ? Math.round(tapado) : 0;
}

/** Publica a altura do teclado virtual em `--altura-teclado`, no <html>.
 *
 *  O problema que isto resolve: no iOS o teclado NÃO encolhe a página. As
 *  unidades `dvh` continuam a valer o ecrã inteiro, portanto uma folha com
 *  `height: calc(100dvh - 38px)` — o Registro Rápido — mantém a altura toda e
 *  o teclado desenha-se por cima do terço de baixo dela. É justamente onde
 *  está o botão "Salvar" (`.acoes` tem `margin-top: auto`, ou seja, encostado
 *  ao fundo), e ele ficava tapado assim que se tocava no campo Valor. Não
 *  havia como gravar sem primeiro fechar o teclado, coisa que não é óbvia.
 *
 *  Com o token publicado, a folha sobe e encurta-se pela altura do teclado
 *  (BottomSheet.module.css) — o botão passa a ficar sempre logo acima dele.
 *
 *  Fica no App e não numa folha específica porque a mesma medida serve o
 *  Login, que também é um formulário e está fora do AppShell.
 *
 *  Em computador, e em qualquer browser sem `visualViewport`, o valor é sempre
 *  0px e nada muda. */
export function useAlturaTeclado() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let ultimo = -1;
    const aplicar = () => {
      const altura = medir();
      // Só escreve quando muda: `resize`/`scroll` da janela visual disparam a
      // cada frame enquanto o teclado sobe, e reescrever a mesma custom
      // property invalida o layout à toa.
      if (altura === ultimo) return;
      ultimo = altura;
      document.documentElement.style.setProperty("--altura-teclado", `${altura}px`);
    };

    aplicar();
    vv.addEventListener("resize", aplicar);
    vv.addEventListener("scroll", aplicar);
    return () => {
      vv.removeEventListener("resize", aplicar);
      vv.removeEventListener("scroll", aplicar);
      document.documentElement.style.removeProperty("--altura-teclado");
    };
  }, []);
}
