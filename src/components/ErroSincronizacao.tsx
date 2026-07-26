import { CloudOff } from "lucide-react";
import styles from "./ErroSincronizacao.module.css";

/** Aviso de sincronização caída — mesmo formato do EstadoVazio (ícone num
 *  círculo, mensagem, sub), mas em tom de alerta e com uma saída.
 *
 *  É deliberadamente distinto do vazio: "não há nada" e "não conseguimos
 *  saber se há algo" são coisas diferentes, e confundir as duas faz o
 *  utilizador achar que perdeu dados.
 *
 *  "Tentar novamente" recarrega a página: refazer a subscrição à mão exigiria
 *  reconstruir a sessão e as dez subscrições na ordem certa, e um reload faz
 *  isso de raiz — os dados locais persistidos voltam na hora. */
export default function ErroSincronizacao({
  mensagem = "Não foi possível sincronizar",
  sub = "O que está na tela pode estar desatualizado.",
  compacto = false,
}: {
  mensagem?: string;
  sub?: string;
  /** Faixa fina em vez da caixa cheia: para usar ACIMA de uma lista que ainda
   *  tem dados. A caixa cheia substituiria esses dados, que continuam válidos
   *  — só pararam de ser atualizados. */
  compacto?: boolean;
}) {
  if (compacto) {
    return (
      <div className={styles.tira} role="status">
        <CloudOff size={15} aria-hidden />
        <span className={styles.tiraTexto}>{mensagem} — os dados podem estar desatualizados.</span>
        <button className={styles.tiraBotao} onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={styles.caixa} role="status">
      <span className={styles.icone}>
        <CloudOff size={26} aria-hidden />
      </span>
      <p className={styles.mensagem}>{mensagem}</p>
      <p className={styles.sub}>{sub}</p>
      <button className={styles.botao} onClick={() => window.location.reload()}>
        Tentar novamente
      </button>
    </div>
  );
}
