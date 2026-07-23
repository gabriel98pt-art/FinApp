import { Plus } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import styles from "./Fab.module.css";

/** FAB de registro rápido — só no desktop; no mobile o botão central da
 *  barra de navegação assume este papel (Marco 2). */
export default function Fab() {
  const abrirRegistro = useUiStore((s) => s.abrirRegistro);

  return (
    <button className={styles.fab} onClick={() => abrirRegistro()} aria-label="Registro rápido">
      <Plus size={26} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
