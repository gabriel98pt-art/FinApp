import { useRef, useState } from "react";
import { Check, ListFilter } from "lucide-react";
import FolhaAncorada from "./FolhaAncorada";
import styles from "./SeletorOrdemFolha.module.css";

/** Botão redondo de ordenação + lista de opções (a atual marcada). Alternativa
 *  à fileira de botões do `SeletorOrdem` para listas com mais opções do que
 *  cabem numa linha — hoje só a tela Parcelas, com 8.
 *
 *  Abre em folha no telemóvel e colado ao botão no desktop (ver
 *  `FolhaAncorada`).
 *
 *  Genérico no tipo da ordem: cada tela passa as suas opções e rótulos. */
export default function SeletorOrdemFolha<T extends string>({
  valor,
  opcoes,
  rotulos,
  aoMudar,
}: {
  valor: T;
  opcoes: readonly T[];
  rotulos: Record<T, string>;
  aoMudar: (o: T) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        className={styles.botao}
        // Segundo clique fecha — ver a mesma nota no `Seletor`.
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        aria-label={`Ordenar por — atual: ${rotulos[valor]}`}
        title={`Ordenar: ${rotulos[valor]}`}
      >
        <ListFilter size={16} aria-hidden />
      </button>

      <FolhaAncorada
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Ordenar por"
        ancoraRef={gatilhoRef}
      >
        <div className={styles.opcoes} role="radiogroup" aria-label="Ordenar por">
          {opcoes.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={valor === o}
              className={`${styles.opcao} ${valor === o ? styles.ativa : ""}`}
              onClick={() => {
                aoMudar(o);
                setAberta(false);
              }}
            >
              <span>{rotulos[o]}</span>
              {valor === o && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      </FolhaAncorada>
    </>
  );
}
