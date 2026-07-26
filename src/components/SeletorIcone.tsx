import BottomSheet from "./BottomSheet";
import { ICONES_CATEGORIA } from "../constants/aparenciaCategoria";
import styles from "./SeletorAparencia.module.css";

/** Grade curada de ícones do `lucide-react` (item 19), dentro de uma folha do
 *  app. `aoEscolher(null)` limpa. */
export default function SeletorIcone({
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
  /** Id do ícone escolhido hoje, ou "" quando não há nenhum. */
  valor: string;
  aoEscolher: (icone: string | null) => void;
  nivel?: number;
}) {
  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      <button type="button" className={styles.limpar} onClick={() => aoEscolher(null)}>
        Sem ícone
      </button>
      <div className={`${styles.grade} ${styles.gradeIcone}`}>
        {ICONES_CATEGORIA.map(({ id, Icone }) => (
          <button
            key={id}
            type="button"
            className={`${styles.icone} ${id === valor ? styles.iconeAtivo : ""}`}
            aria-pressed={id === valor}
            aria-label={id}
            onClick={() => aoEscolher(id)}
          >
            <Icone size={20} aria-hidden />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
