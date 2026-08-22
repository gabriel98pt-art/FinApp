import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const SELETOR_RADIO = '[role="radio"]:not([aria-disabled="true"]):not([disabled])';

function radiosDoGrupo(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(SELETOR_RADIO));
}

const PROXIMO = ["ArrowRight", "ArrowDown"];
const ANTERIOR = ["ArrowLeft", "ArrowUp"];

/** Padrão de teclado do WAI-ARIA APG pra `radiogroup` — achado da auditoria
 *  de Acessibilidade: os ~14 radiogroup do app (fileiras de botões "Mês/
 *  Semana", "Ordenar por"...) não tinham nada disto, e um leitor de tela
 *  anunciava "3 de 12" sem a seta fazer nada.
 *
 *  Setas MOVEM E ESCOLHEM (não só focam — é como um `<input type=radio>`
 *  nativo já se comporta), Home/End vão pro primeiro/último, e só UM rádio
 *  do grupo fica na ordem do Tab por vez (tabindex giratório): Tab entra/sai
 *  do grupo inteiro numa parada só, não uma por opção.
 *
 *  Acha os `[role="radio"]` do grupo pelo DOM, não por prop — os sites que
 *  usam isto já marcam `aria-checked` certo sozinhos (é a lógica de cada
 *  um), então não há nada a duplicar aqui, só ler o que já está renderizado.
 *  Basta pôr `ref` e `onKeyDown` no `<div role="radiogroup">`.
 *
 *  Não é o mesmo desenho do `useAbasTeclado` (o par tab/tablist já correto):
 *  aquele recebe `opcoes`/`valor`/`aoMudar` porque toda aba do app é
 *  simples, uma lista paralela a um valor só. Radiogroup aqui não é: o
 *  "Tipo de lançamento" do Registro Rápido tem uma opção ("Veículo") que
 *  não é o próprio `tipo`, e o `SeletorOrdemFolha` mistura opções simples
 *  com pares seta-cima/seta-baixo. Forçar esses casos numa lista paralela
 *  exigiria gambiarra; ler o DOM já renderizado (que cada site já monta
 *  correto, com sua própria lógica) funciona pros dois formatos sem
 *  distinção. */
export function useRadiogroupTeclado<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  onKeyDown: (e: KeyboardEvent<T>) => void;
} {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    function atualizarTabIndex() {
      const radios = radiosDoGrupo(container!);
      const marcado = radios.find((r) => r.getAttribute("aria-checked") === "true") ?? radios[0];
      for (const r of radios) r.tabIndex = r === marcado ? 0 : -1;
    }

    atualizarTabIndex();
    // Reage à mudança de opção marcada sem precisar de mais nenhuma prop:
    // observa o atributo aria-checked dos filhos, que cada site já atualiza
    // sozinho quando o estado dele muda.
    const obs = new MutationObserver(atualizarTabIndex);
    obs.observe(container, { attributes: true, attributeFilter: ["aria-checked"], subtree: true });
    return () => obs.disconnect();
  }, []);

  function onKeyDown(e: KeyboardEvent<T>) {
    const container = ref.current;
    if (!container) return;
    if (![...PROXIMO, ...ANTERIOR, "Home", "End"].includes(e.key)) return;

    const radios = radiosDoGrupo(container);
    if (radios.length === 0) return;

    let alvo: HTMLElement;
    if (e.key === "Home") {
      alvo = radios[0];
    } else if (e.key === "End") {
      alvo = radios[radios.length - 1];
    } else {
      const atual = radios.indexOf(document.activeElement as HTMLElement);
      const base = atual === -1 ? 0 : atual;
      const passo = PROXIMO.includes(e.key) ? 1 : -1;
      alvo = radios[(base + passo + radios.length) % radios.length];
    }

    e.preventDefault();
    alvo.focus();
    alvo.click();
  }

  return { ref, onKeyDown };
}
