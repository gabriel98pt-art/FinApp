import BottomSheet from "./BottomSheet";
import { EMOJIS_CATEGORIA } from "../constants/aparenciaCategoria";
import styles from "./SeletorAparencia.module.css";

/** Grade curada de emojis (item 19), dentro de uma folha do app — não o
 *  teclado de emoji do sistema. `aoEscolher(null)` limpa. */
export default function SeletorEmoji({
  aberta,
  aoFechar,
  titulo,
  valor,
  aoEscolher,
  nivel,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  valor: string;
  aoEscolher: (emoji: string | null) => void;
  nivel?: number;
}) {
  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      <button type="button" className={styles.limpar} onClick={() => aoEscolher(null)}>
        Sem emoji
      </button>
      <div className={`${styles.grade} ${styles.gradeEmoji}`}>
        {EMOJIS_CATEGORIA.map((e) => (
          <button
            key={e}
            type="button"
            className={`${styles.emoji} ${e === valor ? styles.emojiAtivo : ""}`}
            aria-pressed={e === valor}
            onClick={() => aoEscolher(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
