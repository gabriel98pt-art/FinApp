import { Check } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { CORES_CATEGORIA } from "../constants/aparenciaCategoria";
import { corDoIconeSobre } from "../utils/categoriaVisual";
import styles from "./SeletorAparencia.module.css";

/** Grade de cores predefinidas com marca de seleção na cor ativa (item 19).
 *  `aoEscolher(null)` volta pra cor automática da categoria. */
export default function SeletorCor({
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
  aoEscolher: (cor: string | null) => void;
  nivel?: number;
}) {
  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      <button type="button" className={styles.limpar} onClick={() => aoEscolher(null)}>
        Cor automática
      </button>
      <div className={`${styles.grade} ${styles.gradeCor}`}>
        {CORES_CATEGORIA.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.cor} ${c === valor ? styles.corAtiva : ""}`}
            style={{ background: c }}
            aria-label={`Cor ${c}`}
            aria-pressed={c === valor}
            onClick={() => aoEscolher(c)}
          >
            {c === valor && (
              <Check
                size={16}
                strokeWidth={3}
                className={styles.marca}
                color={corDoIconeSobre(c)}
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
