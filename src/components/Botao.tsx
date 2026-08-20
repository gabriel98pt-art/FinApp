import type { ButtonHTMLAttributes } from "react";
import styles from "./Botao.module.css";

/** Os cinco papéis que um botão desempenha na app. Tudo o que não caiba aqui
 *  ou é um controlo (segmento, chip, selo — esses têm componente próprio) ou é
 *  um papel novo, e nesse caso entra como variante, não como CSS solto na
 *  página. */
export type VarianteBotao = "primaria" | "submeter" | "texto" | "perigo" | "perigoForte";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante: VarianteBotao;
};

/** Botão da app.
 *
 *  Existia em seis cópias feitas à mão só na versão "pílula azul cheia"
 *  (Despesas, Veículo, Cartões, Orçamento, Calendário), nove na versão
 *  "Salvar" das folhas e quatro na versão "adicionar" de cabeçalho — cada uma
 *  com um tamanho ou um padding ligeiramente diferente, sem que a diferença
 *  quisesse dizer nada. A folha de estilo de uma página é o sítio errado para
 *  redecidir o que é um botão primário.
 *
 *  `className` continua a ser aceite e vem depois das classes da variante, para
 *  quem precisa de layout local (largura, alinhamento na grelha) sem redefinir
 *  o desenho. */
export default function Botao({ variante, className, type, ...resto }: Props) {
  return (
    <button
      // <button> sem type dentro de <form> submete por omissão, e quase nenhuma
      // das chamadas quer isso; quem quer passa type="submit".
      type={type ?? "button"}
      className={`${styles.base} ${styles[variante]}${className ? ` ${className}` : ""}`}
      {...resto}
    />
  );
}
