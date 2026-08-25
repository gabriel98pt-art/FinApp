import { useState } from "react";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import styles from "./SeletorLocal.module.css";

/** Acima deste tamanho a fileira passa a vir dobrada. Abaixo dele mostra-se
 *  tudo: com meia dúzia de chips a fileira ocupa duas linhas e já se lê de
 *  relance — acrescentar ali um botão "mais" seria um controlo a mais para
 *  esconder nada. */
const LIMITE_DOBRAR = 8;

/** Quantos chips ficam à vista quando a fileira vem dobrada. Seis chega para
 *  cobrir os locais do dia a dia (que a ordenação por uso já trouxe para a
 *  frente) sem passar de duas ou três linhas no telemóvel. */
const VISIVEIS = 6;

/** Local de carregamento como fileira de chips — mesma experiência no Registro
 *  Rápido e no formulário de carga da aba Veículo. A lista é `cfg.locaisCarregamento`
 *  e quem a gere é a própria aba Veículo, em Carregamentos: aqui só se escolhe,
 *  nunca se escreve (era texto livre com auto-adição silenciosa).
 *
 *  Quem usa muitos postos tinha aqui um muro: com uma dúzia de locais a
 *  fileira crescia para sete linhas e empurrava custo, kWh, data, cartão e o
 *  botão Adicionar para fora do ecrã — era preciso rolar por cima de todos os
 *  locais em cada abastecimento, mesmo carregando quase sempre no mesmo sítio.
 *  Daí a fileira vir dobrada nos primeiros `VISIVEIS`, com o resto atrás de um
 *  "+N". Quem passa a `opcoes` decide a ordem (o Registro Rápido ordena pelo
 *  uso real — ver `utils/locais.ts`), portanto os primeiros são os prováveis. */
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
  const [expandido, setExpandido] = useState(false);

  const dobravel = lista.length > LIMITE_DOBRAR;
  // O escolhido nunca pode ficar escondido: sem isto, escolher um local do
  // fundo da lista e voltar a dobrar deixava a fileira sem nenhum chip aceso,
  // como se nada estivesse escolhido.
  const escolhidoEscondido = dobravel && !expandido && lista.indexOf(valor) >= VISIVEIS;
  const visiveis =
    !dobravel || expandido
      ? lista
      : escolhidoEscondido
        ? [...lista.slice(0, VISIVEIS - 1), valor]
        : lista.slice(0, VISIVEIS);
  const escondidos = lista.length - visiveis.length;

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
          {visiveis.map((l) => (
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
          {/* Fora do `role="radiogroup"` em espírito — é um botão de mostrar/
              esconder, não uma opção. Fica dentro da caixa para acompanhar a
              fileira, mas sem `role="radio"`: anunciá-lo como opção faria o
              leitor de ecrã contar "7 de 7 locais" e um deles não ser local
              nenhum. A navegação por setas do `useRadiogroupTeclado` só olha
              para os `role="radio"`, portanto também o ignora. */}
          {dobravel && (
            <button
              type="button"
              className={styles.mais}
              aria-expanded={expandido}
              onClick={() => setExpandido((e) => !e)}
            >
              {expandido ? "Mostrar menos" : `+${escondidos} locais`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
