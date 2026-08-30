import type { LucideIcon } from "lucide-react";
import type { RefObject } from "react";
import FolhaAncorada from "./FolhaAncorada";
import styles from "./MenuAcoesItem.module.css";

export interface AcaoItem {
  rotulo: string;
  Icone: LucideIcon;
  onClick: () => void;
  /** Ação destrutiva (Excluir/Remover) — mesmo vermelho do resto do app. */
  tone?: "perigo";
}

/** Menu único de ações por item de lista (item 2 do lote de UX/nav de
 *  30/08): Editar / Marcar como pago / Deletar — a lista de ações varia por
 *  tipo, quem chama é que decide. Substitui os 5 padrões diferentes que
 *  cada tela tinha (linha inteira abrindo o form direto, ícones soltos
 *  sempre visíveis, botões de texto ao lado do corpo…) por UM só, em toda
 *  aba com item de lista.
 *
 *  Reaproveita `FolhaAncorada` (bottom sheet no mobile, popover ancorado no
 *  desktop) — já existia, só nunca tinha sido usada pra isto. */
export default function MenuAcoesItem({
  aberta,
  aoFechar,
  titulo,
  ancoraRef,
  acoes,
  nivel,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** Nome acessível do menu — normalmente a descrição/título do item. */
  titulo: string;
  ancoraRef: RefObject<HTMLElement | null>;
  acoes: AcaoItem[];
  nivel?: number;
}) {
  return (
    <FolhaAncorada
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={titulo}
      ancoraRef={ancoraRef}
      nivel={nivel}
    >
      <div className={styles.lista}>
        {acoes.map(({ rotulo, Icone, onClick, tone }) => (
          <button
            key={rotulo}
            type="button"
            className={`${styles.acao} ${tone === "perigo" ? styles.perigo : ""}`}
            onClick={() => {
              aoFechar();
              onClick();
            }}
          >
            <Icone size={17} aria-hidden />
            {rotulo}
          </button>
        ))}
      </div>
    </FolhaAncorada>
  );
}
