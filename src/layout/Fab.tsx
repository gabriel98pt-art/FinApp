import { Plus } from "lucide-react";
import styles from "./Fab.module.css";

/** FAB de registro rápido. Abrir a bottom sheet é Marco 2 — por ora só existe. */
export default function Fab() {
  return (
    <button className={styles.fab} aria-label="Registro rápido">
      <Plus size={26} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
