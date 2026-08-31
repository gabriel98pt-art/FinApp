import { useEffect, useId, useRef } from "react";
import { useAcaoHeaderStore, type AcaoHeader } from "../stores/acaoHeaderStore";

/** Assinatura só de TEXTO da ação. Os `onClick` mudam de identidade a cada
 *  render da página (são quase sempre arrow functions escritas ali mesmo), e
 *  usá-los como dependência do efeito fazia o header voltar a registar-se sem
 *  parar. O que o header desenha é texto — o rótulo e, se houver menu, os
 *  rótulos das opções — portanto é o texto que decide quando há mesmo algo
 *  novo para registar. */
function assinatura(acao: AcaoHeader | null): string {
  if (!acao) return "";
  return `${acao.rotulo} ${(acao.acoes ?? []).map((a) => a.rotulo).join(" ")}`;
}

/** Põe um "+" no cabeçalho enquanto esta página estiver aberta, e tira-o
 *  quando ela sai. Passar `null` (ou uma condição falsa) é o mesmo que não ter
 *  botão nenhum — serve para as telas com abas internas em que só algumas têm
 *  o que adicionar.
 *
 *  Uso:
 *    useAcaoHeader({ rotulo: "Adicionar evento", onClick: abrirNovoEvento });
 *
 *  ou, com vários fluxos na mesma tela:
 *    useAcaoHeader({ rotulo: "Adicionar", acoes: [{ rotulo, Icone, onClick }] });
 *
 *  Não é preciso memoizar nada do lado de quem chama: os handlers ficam num
 *  ref e são sempre lidos na versão mais recente. */
export function useAcaoHeader(acao: AcaoHeader | null): void {
  const definir = useAcaoHeaderStore((s) => s.definir);
  const limpar = useAcaoHeaderStore((s) => s.limpar);

  // Cada montagem tem o seu dono, para não apagar a ação de outra página: na
  // navegação, a limpeza da tela que sai e o registo da que entra correm no
  // mesmo commit, e a ordem entre elas não é nossa para garantir.
  const dono = useId();

  const atualRef = useRef(acao);
  // Efeito sem dependências de propósito: corre a seguir a TODO render, e
  // antes do efeito de registo logo abaixo (os efeitos correm pela ordem em
  // que são declarados), portanto quem lá chega já lê a versão desta volta.
  useEffect(() => {
    atualRef.current = acao;
  });

  const chave = assinatura(acao);

  useEffect(() => {
    const atual = atualRef.current;
    if (!atual) {
      limpar(dono);
      return;
    }
    definir(dono, {
      rotulo: atual.rotulo,
      // Os handlers vão sempre buscar a versão do render mais recente, em vez
      // de congelar a do render em que este efeito correu.
      onClick: () => atualRef.current?.onClick?.(),
      acoes: atual.acoes?.map((a, i) => ({
        ...a,
        onClick: () => atualRef.current?.acoes?.[i]?.onClick(),
      })),
    });
    return () => limpar(dono);
  }, [chave, dono, definir, limpar]);
}
