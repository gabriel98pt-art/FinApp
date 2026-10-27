import { Plus } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import styles from "./Fab.module.css";

/** FAB de registro rápido — só no desktop; no mobile o botão central da
 *  barra de navegação assume este papel (Marco 2). Preto (creme no
 *  escuro) como o "+" da barra do iPhone — já não veste a cor da página.
 *  Abre o menu do "+" (item 1 do lote de UX/nav), não o formulário direto —
 *  ver `MenuRegistroRapido`. */
export default function Fab() {
  const abrirMenuRegistro = useUiStore((s) => s.abrirMenuRegistro);

  return (
    <button className={styles.fab} onClick={() => abrirMenuRegistro()} aria-label="Registro rápido">
      <Plus size={26} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
