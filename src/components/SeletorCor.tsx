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
 *  de uma bolha, e `corDoIconeSobre` já garante o ícone legível por cima.
 *
 *  `coresEmUso`, se passado, marca com um pontinho discreto qualquer cor já
 *  usada por OUTRA categoria (pedido do Gabriel, 26/08: evitar repetir cor
 *  sem querer). Não impede escolher — só avisa; quem chama decide o que
 *  conta como "outra" (normalmente as demais categorias da mesma lista).
 *
 *  `cores`, se passado, substitui a grade padrão (`CORES_CATEGORIA`) — usado
 *  só pelas fontes de receita, que têm o verde de volta na frente
 *  (`CORES_FONTE_RECEITA`, item 6 do lote de UX/nav de 30/08): o resto do
 *  app (despesa, veículo) continua na grade sem verde, sem tocar aqui. */
export default function SeletorCor({
  aberta,
  aoFechar,
  titulo,
  valor,
  aoEscolher,
  nivel,
  corDeFundo,
  coresEmUso,
  cores = CORES_CATEGORIA,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  valor: string;
  aoEscolher: (cor: string | null) => void;
  nivel?: number;
  corDeFundo?: string[];
  coresEmUso?: string[];
  cores?: string[];
}) {
  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo={titulo} nivel={nivel}>
      <button type="button" className={styles.limpar} onClick={() => aoEscolher(null)}>
        Cor automática
      </button>
      <div className={`${styles.grade} ${styles.gradeCor}`}>
        {cores.map((c) => {
          const reprovada =
            !!corDeFundo && corDeFundo.some((fundo) => razaoContraste(c, fundo) < CONTRASTE_MINIMO);
          const emUso = c !== valor && !!coresEmUso?.includes(c);
          return (
            <button
              key={c}
              type="button"
              className={`${styles.cor} ${c === valor ? styles.corAtiva : ""} ${reprovada ? styles.corReprovada : ""} ${emUso ? styles.corEmUso : ""}`}
              style={{ background: c }}
              aria-label={
                reprovada
                  ? `Cor ${c}, contraste insuficiente`
                  : emUso
                    ? `Cor ${c}, já usada por outra categoria`
                    : `Cor ${c}`
              }
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
