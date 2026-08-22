import { Check } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { CORES_CATEGORIA } from "../constants/aparenciaCategoria";
import { corDoIconeSobre, razaoContraste } from "../utils/categoriaVisual";
import styles from "./SeletorAparencia.module.css";

/** Mínimo AA (WCAG) pra texto normal — usado quando `corDeFundo` é passado. */
const CONTRASTE_MINIMO = 4.5;

/** Grade de cores predefinidas com marca de seleção na cor ativa (item 19).
 *  `aoEscolher(null)` volta pra cor automática da categoria.
 *
 *  `corDeFundo`, se passado, desativa (sem remover da grade) qualquer cor que
 *  reprove contraste AA contra alguma dessas cores — usado só onde a escolha
 *  vira texto/contorno sobre um fundo fixo (personalização de cor do app,
 *  ver `PainelCoresApp`). Sem essa prop o seletor de cor de categoria
 *  continua oferecendo a paleta inteira, como sempre: lá a cor é só o fundo
 *  de uma bolha, e `corDoIconeSobre` já garante o ícone legível por cima. */
export default function SeletorCor({
  aberta,
  aoFechar,
  titulo,
  valor,
  aoEscolher,
  nivel,
  corDeFundo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  valor: string;
  aoEscolher: (cor: string | null) => void;
  nivel?: number;
  corDeFundo?: string[];
}) {
  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      <button type="button" className={styles.limpar} onClick={() => aoEscolher(null)}>
        Cor automática
      </button>
      <div className={`${styles.grade} ${styles.gradeCor}`}>
        {CORES_CATEGORIA.map((c) => {
          const reprovada =
            !!corDeFundo && corDeFundo.some((fundo) => razaoContraste(c, fundo) < CONTRASTE_MINIMO);
          return (
            <button
              key={c}
              type="button"
              className={`${styles.cor} ${c === valor ? styles.corAtiva : ""} ${reprovada ? styles.corReprovada : ""}`}
              style={{ background: c }}
              aria-label={reprovada ? `Cor ${c}, contraste insuficiente` : `Cor ${c}`}
              aria-pressed={c === valor}
              aria-disabled={reprovada}
              disabled={reprovada}
              title={reprovada ? "Contraste insuficiente contra o fundo do app" : undefined}
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
          );
        })}
      </div>
    </BottomSheet>
  );
}
