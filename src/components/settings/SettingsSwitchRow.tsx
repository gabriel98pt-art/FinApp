import type { LucideIcon } from "lucide-react";
import styles from "./SettingsSwitchRow.module.css";

/** Linha de Definições com um interruptor — TVDE, Modo discreto, e cada
 *  preferência de Notificações. `role="switch"` + `aria-checked` porque não
 *  existe `<input type="checkbox">` nativo com esta aparência; o toque em
 *  qualquer ponto do controlo alterna, como um switch de verdade. */
export default function SettingsSwitchRow({
  titulo,
  Icone,
  checked,
  onChange,
  disabled = false,
}: {
  titulo: string;
  /** Opcional — Notificações usa um ícone por tipo, TVDE/Modo discreto não. */
  Icone?: LucideIcon;
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.linha}>
      <span className={styles.tituloComIcone}>
        {Icone && <Icone size={17} className={styles.icone} aria-hidden />}
        <span className={styles.titulo}>{titulo}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={titulo}
        disabled={disabled}
        className={`${styles.switch} ${checked ? styles.ligado : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.polegar} aria-hidden />
      </button>
    </div>
  );
}
