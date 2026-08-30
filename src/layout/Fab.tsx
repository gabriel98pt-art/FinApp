import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCfgStore } from "../stores/cfgStore";
import { useUiStore } from "../stores/uiStore";
import { estiloBotaoRegistro } from "../utils/corBotaoRegistro";
import styles from "./Fab.module.css";

/** FAB de registro rápido — só no desktop; no mobile o botão central da
 *  barra de navegação assume este papel (Marco 2). Em Despesas/Receitas/
 *  Veículo veste a cor daquele domínio; nas outras fica no azul do app.
 *  Abre o menu do "+" (item 1 do lote de UX/nav), não o formulário direto —
 *  ver `MenuRegistroRapido`. */
export default function Fab() {
  const abrirMenuRegistro = useUiStore((s) => s.abrirMenuRegistro);
  const cfg = useCfgStore((s) => s.cfg);
  const { pathname } = useLocation();

  return (
    <button
      className={styles.fab}
      style={estiloBotaoRegistro(cfg, pathname)}
      onClick={() => abrirMenuRegistro()}
      aria-label="Registro rápido"
    >
      <Plus size={26} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
