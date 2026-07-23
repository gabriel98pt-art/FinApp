import { useToastStore } from "../stores/toastStore";
import styles from "./Toast.module.css";

export default function Toast() {
  const mensagem = useToastStore((s) => s.mensagem);
  const visivel = useToastStore((s) => s.visivel);

  return (
    <div
      className={`${styles.toast} ${visivel ? styles.visivel : ""}`}
      role="status"
      aria-live="polite"
    >
      {mensagem}
    </div>
  );
}
