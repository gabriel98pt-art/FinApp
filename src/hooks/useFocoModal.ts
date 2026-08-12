import { useEffect, useId, useRef } from "react";

/** Gestão de foco das folhas modais (`BottomSheet`).
 *
 *  O `Popover` — o par de desktop — já fechava com Esc e desmontava fechado.
 *  A folha não fazia nem uma coisa nem outra, e é ela que serve as ~19 folhas
 *  do app e todo o telemóvel. Este hook fecha essa diferença:
 *
 *  1. **Esc fecha**, como no popover e como manda um `role="dialog"`.
 *  2. **O foco entra** na folha ao abrir. Vai para o contentor, não para o
 *     primeiro botão: em várias folhas o primeiro focável é destrutivo
 *     ("Excluir"), e num formulário focar o primeiro campo levanta o teclado
 *     do telemóvel por cima da folha que a pessoa ainda nem leu.
 *  3. **O foco volta** ao elemento que abriu a folha quando ela fecha — senão
 *     ficava na raiz do documento e o Tab seguinte recomeçava no topo da
 *     página, longe de onde a pessoa estava.
 *  4. **O Tab circula por dentro** enquanto está aberta. Sem isto o Tab saía
 *     para a página por baixo, que está tapada pelo véu: o foco desaparecia.
 *
 *  Folhas aninhadas (o `Seletor` abre uma folha de dentro do formulário, que
 *  já é outra folha) partilham uma pilha: só a folha do topo responde ao Esc e
 *  prende o Tab, senão as duas disputavam o mesmo teclado. */

/** Ids das folhas abertas, na ordem em que abriram. Só o topo manda. */
const pilha: string[] = [];

const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocoModal({
  aberta,
  folhaRef,
  aoFechar,
}: {
  aberta: boolean;
  folhaRef: React.RefObject<HTMLDivElement | null>;
  aoFechar: () => void;
}) {
  /** Identidade estável desta folha dentro da pilha. */
  const id = useId();

  /** Quem tinha o foco antes de a folha abrir, para lho devolver no fecho. */
  const anterior = useRef<HTMLElement | null>(null);

  // `aoFechar` chega quase sempre como arrow inline (`() => setAberta(false)`),
  // ou seja, muda de identidade a cada render. Se entrasse nas dependências do
  // efeito de baixo, ele voltava a correr a cada render com a folha aberta — e
  // o `focus()` da abertura roubava o cursor do campo a cada tecla escrita.
  // Guardado num ref, o efeito depende só de `aberta` e continua a chamar
  // sempre a versão mais recente.
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    if (!aberta) return;

    // A folha vive num portal e não é substituída enquanto está aberta, por
    // isso guardar o nó aqui é seguro — e é o que a limpeza precisa de ler.
    const folha = folhaRef.current;
    pilha.push(id);

    anterior.current = document.activeElement as HTMLElement | null;
    // Num frame à parte: no mesmo tick a folha ainda tem `pointer-events:none`
    // e o browser recusa o foco.
    const frame = requestAnimationFrame(() => folha?.focus());

    const aoTeclar = (e: KeyboardEvent) => {
      // Só a folha do topo reage: com o seletor aberto dentro do formulário,
      // um Esc tem de fechar o seletor e deixar o formulário aberto.
      if (pilha[pilha.length - 1] !== id) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        fechar.current();
        return;
      }

      if (e.key !== "Tab" || !folha) return;

      const focaveis = [...folha.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(
        // `offsetParent` nulo = escondido; apanha as opções de uma folha
        // aninhada que ainda não abriu mas já está montada.
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

      if (focaveis.length === 0) {
        // Folha sem nada focável (só texto): o Tab não tem para onde ir por
        // dentro, e deixá-lo sair punha o foco atrás do véu.
        e.preventDefault();
        return;
      }

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const foco = document.activeElement;

      if (!e.shiftKey && (foco === ultimo || foco === folha)) {
        e.preventDefault();
        primeiro.focus();
      } else if (e.shiftKey && (foco === primeiro || foco === folha)) {
        e.preventDefault();
        ultimo.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", aoTeclar);
      const i = pilha.lastIndexOf(id);
      if (i !== -1) pilha.splice(i, 1);

      // Devolve o foco só se ele ainda estiver dentro desta folha. Se entretanto
      // foi parar a outro sítio (a folha fechou porque a pessoa clicou noutra
      // coisa), respeitamos onde está.
      if (folha?.contains(document.activeElement) || document.activeElement === document.body) {
        anterior.current?.focus?.();
      }
    };
  }, [aberta, folhaRef, id]);
}
