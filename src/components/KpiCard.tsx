import styles from "./KpiCard.module.css";

export type TomKpi = "neutro" | "acento" | "verde" | "vermelho" | "amarelo";

const TOM_CLASSE: Record<TomKpi, string> = {
  neutro: "",
  acento: styles.acento,
  verde: styles.verde,
  vermelho: styles.vermelho,
  amarelo: styles.amarelo,
};

export default function KpiCard({
  rotulo,
  valor,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  tom?: TomKpi;
}) {
  return (
    <div className={styles.card}>
      <p className={styles.rotulo}>{rotulo}</p>
      <p className={`${styles.valor} ${TOM_CLASSE[tom]}`}>{valor}</p>
    </div>
  );
}
