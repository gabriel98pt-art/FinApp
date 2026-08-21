import type { ReactNode } from "react";
import styles from "./SettingsSection.module.css";

/** Uma seção agrupada de Definições: título discreto por cima, cartão com as
 *  linhas dentro. A divisória entre linhas vem daqui (`.cartao > *`), não de
 *  cada linha — assim `SettingsRow`/`SettingsSwitchRow` não precisam saber a
 *  própria posição na lista. */
export default function SettingsSection({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.secao}>
      <p className={styles.titulo}>{titulo}</p>
      <div className={styles.cartao}>{children}</div>
    </section>
  );
}
