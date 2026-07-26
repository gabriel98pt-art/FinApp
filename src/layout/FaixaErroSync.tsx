import { CloudOff } from "lucide-react";
import { useCfgStore } from "../stores/cfgStore";
import styles from "./FaixaErroSync.module.css";

/** Aviso global de sincronização caída, só para a config da conta.
 *
 *  A `cfg` é o único domínio usado em toda a app (moeda, categorias, contas,
 *  tetos), então uma falha nela afeta qualquer tela — avisar só na página
 *  aberta esconderia o problema. Os outros domínios avisam na sua própria
 *  tela, via ErroSincronizacao.
 *
 *  A faixa não bloqueia nada: o resto do app continua navegável com o que já
 *  estava carregado. */
export default function FaixaErroSync() {
  const erro = useCfgStore((s) => s.erro);
  if (!erro) return null;

  return (
    <div className={styles.faixa} role="status">
      <CloudOff size={15} aria-hidden />
      <span className={styles.texto}>Não foi possível sincronizar.</span>
      <button className={styles.botao} onClick={() => window.location.reload()}>
        Tentar novamente
      </button>
    </div>
  );
}
