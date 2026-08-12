import { useRef, type KeyboardEvent } from "react";

/** Teclado do padrão ARIA de abas: setas, Home/End e tabindex rotativo.
 *
 *  Faltava a segunda metade do padrão. Com `role="tab"` declarado e nada mais,
 *  um leitor de ecrã anuncia "separador 2 de 5" e a pessoa tenta a seta — que
 *  é o que o anúncio promete — e não acontece nada. Ficavam também os cinco
 *  separadores todos na ordem do Tab, o que obriga a passar por cima de quatro
 *  para chegar ao conteúdo.
 *
 *  O que isto faz:
 *
 *  - **Setas** andam de separador em separador, dando a volta nas pontas.
 *    Esquerda/direita porque a lista é horizontal; cima/baixo também, porque
 *    quem usa leitor de ecrã em modo de aplicação costuma tentar as duas.
 *  - **Home/End** saltam para o primeiro e para o último.
 *  - **Tabindex rotativo**: só o separador activo está na ordem do Tab. O Tab
 *    passa a entrar e a sair da lista inteira de uma vez, e a escolha dentro
 *    dela faz-se com as setas — que é a diferença entre um grupo de abas e
 *    cinco botões seguidos.
 *  - **A troca segue o foco** (activação automática), o comportamento normal
 *    de abas quando trocar de painel é barato — e aqui é: os dados já estão
 *    todos em memória, não há pedido nenhum por trás.
 */
export function useAbasTeclado<T extends string>({
  abas,
  atual,
  aoMudar,
}: {
  /** Ids das abas, na ordem em que aparecem na tela. */
  abas: readonly T[];
  atual: T;
  aoMudar: (aba: T) => void;
}) {
  const listaRef = useRef<HTMLDivElement>(null);

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const i = abas.indexOf(atual);
    if (i < 0) return;

    let destino: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        destino = (i + 1) % abas.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        destino = (i - 1 + abas.length) % abas.length;
        break;
      case "Home":
        destino = 0;
        break;
      case "End":
        destino = abas.length - 1;
        break;
      default:
        return;
    }

    // Só depois de sabermos que a tecla é nossa: setas dentro de um tablist
    // não devem rolar a página, mas travar teclas que não tratamos seria pior
    // do que não fazer nada.
    e.preventDefault();
    aoMudar(abas[destino]);

    // O foco tem de ir com a selecção, senão fica no separador antigo e a
    // seta seguinte parte de onde a pessoa já não está.
    const botoes = listaRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    botoes?.[destino]?.focus();
  }

  return {
    /** Vai no contentor com `role="tablist"`. */
    propsLista: { ref: listaRef, onKeyDown: aoTeclar },
    /** Vai em cada botão com `role="tab"`. */
    propsAba: (aba: T) => ({ tabIndex: aba === atual ? 0 : -1 }),
  };
}
