import { ChevronRight } from "lucide-react";
import styles from "./SettingsRow.module.css";

/** Uma linha de Definições: título à esquerda, valor secundário e/ou chevron
 *  à direita. Vira `<button>` quando `onClick` é passado, senão é uma linha
 *  estática (ex.: "Sessão: fulano@exemplo.com"). O chevron é sempre uma
 *  escolha explícita (`navegavel`), nunca inferido do `onClick` — "Sair da
 *  conta" e "Apagar conta" têm ação mas não abrem nada, então não têm seta. */
export default function SettingsRow({
  titulo,
  valor,
  navegavel = false,
  tone = "default",
  onClick,
}: {
  titulo: string;
  valor?: string;
  navegavel?: boolean;
  tone?: "default" | "perigo";
  onClick?: () => void;
}) {
  const conteudo = (
    <>
      <span className={styles.titulo}>{titulo}</span>
      <span className={styles.direita}>
        {valor !== undefined && <span className={styles.valor}>{valor}</span>}
        {navegavel && <ChevronRight size={17} className={styles.chevron} aria-hidden />}
      </span>
    </>
  );
  const classe = `${styles.linha} ${tone === "perigo" ? styles.perigo : ""}`;

  if (onClick) {
    return (
      <button type="button" className={classe} onClick={onClick}>
        {conteudo}
      </button>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}
