import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import styles from "./SeletorLocal.module.css";

/** Local de carregamento como carrossel horizontal — mesma experiência no
 *  Registro Rápido e no formulário de carga da aba Veículo. A lista é
 *  `cfg.locaisCarregamento` e quem a gere é a própria aba Veículo, em
 *  Carregamentos: aqui só se escolhe, nunca se escreve (era texto livre com
 *  auto-adição silenciosa).
 *
 *  Antes disto a fileira dobrava em várias linhas (com um "+N locais" pra
 *  revelar o resto) assim que passava de 8 locais — quem usa muitos postos
 *  via a folha inteira virar uma parede de chips empilhados, poluída visual
 *  mesmo dobrada (achado do Gabriel, 30/08). Um carrossel de UMA linha só,
 *  que rola pro lado, resolve sem esconder nada atrás de um botão: os locais
 *  mais usados (a ordenação por uso já cuida disso) ficam à vista sem rolar,
 *  o resto é um gesto de distância — e a folha nunca cresce em altura por
 *  causa da lista de locais. */
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
  const { ref, onKeyDown } = useRadiogroupTeclado<HTMLDivElement>();

  return (
    <div className={styles.campo}>
      <span>Local</span>
      {lista.length === 0 ? (
        <p className={styles.vazio}>
          Ainda não há locais guardados — adicione um na aba Veículo, em Carregamentos.
        </p>
      ) : (
        <div
          className={styles.fileira}
          role="radiogroup"
          aria-label="Local do carregamento"
          ref={ref}
          onKeyDown={onKeyDown}
        >
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
