import { ORDENS, ROTULOS_ORDEM, type Ordem } from "../utils/ordem";
import styles from "./SeletorOrdem.module.css";

/** Fileira de botões de ordenação acima da lista (item 14). Não persiste:
 *  sair da tela volta ao padrão ("Mais recentes"). */
export default function SeletorOrdem({
  valor,
  aoMudar,
}: {
  valor: Ordem;
  aoMudar: (o: Ordem) => void;
}) {
  return (
    <div className={styles.fileira} role="radiogroup" aria-label="Ordenar por">
      {ORDENS.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          className={`${styles.opcao} ${valor === o ? styles.ativa : ""}`}
          onClick={() => aoMudar(o)}
        >
          {ROTULOS_ORDEM[o]}
        </button>
      ))}
    </div>
  );
}
