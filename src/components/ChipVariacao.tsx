import styles from "./ChipVariacao.module.css";

/** Chip de variação contra uma referência: ▲/▼ e o valor (uma percentagem ou
 *  uma diferença em euros, já formatada em `texto`), na cor de quem vê se é
 *  boa ou má notícia — o sinal vai além da cor (a seta), e o texto escondido
 *  diz o mesmo a quem usa leitor de ecrã.
 *
 *  `sentido` é o lado da variação (1 subiu, -1 desceu, 0 igual); quem usa
 *  decide o que é "pior": para uma despesa subir é pior, para uma receita é
 *  descer. `pior: null` é neutro. Sem `sentido` (nenhuma base de comparação)
 *  não desenha nada. */
export default function ChipVariacao({
  sentido,
  texto,
  pior,
}: {
  sentido: -1 | 0 | 1 | null;
  texto: string;
  pior: boolean | null;
}) {
  if (sentido === null) return null;
  const seta = sentido > 0 ? "▲" : sentido < 0 ? "▼" : "";
  const classe = pior === null ? styles.neutro : pior ? styles.pior : styles.melhor;
  const leitura =
    sentido === 0
      ? "igual à média"
      : `${texto} ${sentido > 0 ? "acima" : "abaixo"} da média${pior === null ? "" : pior ? ", pior" : ", melhor"}`;
  return (
    <span className={`${styles.chip} ${classe}`}>
      <span aria-hidden>{seta ? `${seta} ${texto}` : texto}</span>
      <span className={styles.leitura}>{leitura}</span>
    </span>
  );
}
