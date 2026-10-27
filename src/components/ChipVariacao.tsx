import styles from "./ChipVariacao.module.css";

/** Chip de variação contra uma referência: ▲/▼ e a percentagem, na cor de quem
 *  vê se é boa ou má notícia — o sinal vai além da cor (a seta), e o texto
 *  escondido diz o mesmo a quem usa leitor de ecrã.
 *
 *  Quem usa decide o que é "pior": para uma despesa subir é pior, para uma
 *  receita é descer. `pior: null` é neutro (sem veredicto). Sem `pct` (nenhuma
 *  base de comparação) não desenha nada. */
export default function ChipVariacao({ pct, pior }: { pct: number | null; pior: boolean | null }) {
  if (pct === null) return null;
  const seta = pct > 0 ? "▲" : pct < 0 ? "▼" : "";
  const abs = Math.abs(pct);
  const classe = pior === null ? styles.neutro : pior ? styles.pior : styles.melhor;
  const leitura =
    pct === 0
      ? "igual à média"
      : `${abs}% ${pct > 0 ? "acima" : "abaixo"} da média${pior === null ? "" : pior ? ", pior" : ", melhor"}`;
  return (
    <span className={`${styles.chip} ${classe}`}>
      <span aria-hidden>{seta ? `${seta} ${abs}%` : `${abs}%`}</span>
      <span className={styles.leitura}>{leitura}</span>
    </span>
  );
}
