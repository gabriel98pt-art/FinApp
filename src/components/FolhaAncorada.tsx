import { type ReactNode, type RefObject } from "react";
import BottomSheet from "./BottomSheet";
import Popover from "./Popover";
import { useMediaQuery } from "../hooks/useMediaQuery";

/** Mesmo corte do resto do layout (ver `Pagina.tsx` e `RegistroRapido.tsx`). */
const MOBILE = "(max-width: 767px)";

/** Escolhe como abrir uma lista de opções conforme o tamanho da janela:
 *  `BottomSheet` no telemóvel, `Popover` colado ao gatilho no desktop.
 *
 *  A razão é o ponteiro. No telemóvel a folha sobe de baixo, à distância do
 *  polegar, e fecha-se com arrasto — está bem como está. No ecrã grande, a
 *  mesma folha aparece encostada ao fundo da janela: clicar num botão no topo
 *  da página obrigava a levar o rato até lá abaixo e a voltar. O popover
 *  aparece onde o ponteiro já está.
 *
 *  Só entra onde a escolha é rápida e o contexto à volta importa — os
 *  seletores por linha da importação e o botão de ordenar. Os seletores de
 *  formulário (`Seletor` na variante "campo") continuam em folha: aí a folha
 *  já é o contexto. */
export default function FolhaAncorada({
  aberta,
  aoFechar,
  titulo,
  ancoraRef,
  nivel = 0,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  /** O elemento a que o popover se cola no desktop. Ignorado no telemóvel. */
  ancoraRef: RefObject<HTMLElement | null>;
  /** Empilhamento da folha aninhada — só usado no telemóvel. */
  nivel?: number;
  children: ReactNode;
}) {
  const mobile = useMediaQuery(MOBILE);

  if (mobile) {
    return (
      <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
        {children}
      </BottomSheet>
    );
  }

  return (
    <Popover aberta={aberta} aoFechar={aoFechar} titulo={titulo} ancoraRef={ancoraRef}>
      {children}
    </Popover>
  );
}
