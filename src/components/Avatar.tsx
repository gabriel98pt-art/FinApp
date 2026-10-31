import { iniciaisDe } from "../utils/perfil";
import styles from "./Avatar.module.css";

/** O avatar da pessoa: a foto, ou as iniciais do nome (sem nome, a 1.ª letra do
 *  e-mail). Decorativo — quem o usa dá o nome acessível ao botão à volta. */
export default function Avatar({
  foto,
  nome,
  email,
  tamanho = 32,
}: {
  foto: string;
  nome: string;
  email?: string | null;
  /** Lado em px (círculo). */
  tamanho?: number;
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.4) };
  return (
    <span className={styles.avatar} style={estilo} aria-hidden="true">
      {foto ? (
        <img className={styles.foto} src={foto} alt="" draggable={false} />
      ) : (
        iniciaisDe(nome, email)
      )}
    </span>
  );
}
