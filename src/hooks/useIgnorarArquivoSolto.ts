import { useEffect } from "react";

/** Ficheiro largado FORA de uma zona que o aceite: o navegador abre-o na aba e
 *  o app desaparece do ecrã, sem aviso e sem forma de voltar atrás a não ser
 *  navegar de novo. Quem falha o alvo por dois dedos ao arrastar um extrato
 *  perdia a página inteira.
 *
 *  Aqui, largar fora não faz nada — que é o que qualquer app espera. A zona de
 *  largada da tela Importar continua a funcionar: o `drop` dela corre primeiro
 *  e só depois sobe até aqui.
 *
 *  Só ficheiros: arrastar texto ou uma seleção dentro da página não é tocado. */
export function useIgnorarArquivoSolto() {
  useEffect(() => {
    function ignorar(e: DragEvent) {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
    }
    // `dragover` também tem de ser travado: é ele que diz ao navegador que
    // aquele sítio aceita a largada, e sem isso o `drop` nem chega a ser nosso.
    window.addEventListener("dragover", ignorar);
    window.addEventListener("drop", ignorar);
    return () => {
      window.removeEventListener("dragover", ignorar);
      window.removeEventListener("drop", ignorar);
    };
  }, []);
}
