import styles from "./SeletorLocal.module.css";

/** Local de carregamento como fileira de chips — mesma experiência no Registro
 *  Rápido e no formulário de carga da aba Veículo. A lista é `cfg.locaisCarregamento`
 *  e quem a gere é a própria aba Veículo, em Carregamentos: aqui só se escolhe,
 *  nunca se escreve (era texto livre com auto-adição silenciosa). */
export default function SeletorLocal({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: string;
  opcoes: string[];
  aoMudar: (local: string) => void;
}) {
  // Ao editar uma carga antiga, o local pode já ter saído da lista — mostra-o
  // mesmo assim, senão a edição perderia o valor sem avisar.
  const lista = valor && !opcoes.includes(valor) ? [valor, ...opcoes] : opcoes;

  return (
    <div className={styles.campo}>
      <span>Local</span>
      {lista.length === 0 ? (
        <p className={styles.vazio}>
          Ainda não há locais guardados — adicione um na aba Veículo, em Carregamentos.
        </p>
      ) : (
        <div className={styles.fileira} role="radiogroup" aria-label="Local do carregamento">
          {lista.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={valor === l}
              className={`${styles.local} ${valor === l ? styles.localAtivo : ""}`}
              onClick={() => aoMudar(l)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
