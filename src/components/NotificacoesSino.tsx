import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, CreditCard, Layers, Repeat } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { EstadoVazio } from "./Pagina";
import { useNotificacoes } from "../hooks/useNotificacoes";
import { useCfgStore } from "../stores/cfgStore";
import { formatMoney } from "../utils/money";
import type { TipoNotificacao } from "../utils/notificacoes";
import estilosHeader from "../layout/Header.module.css";
import styles from "./NotificacoesSino.module.css";

/** Para onde cada tipo leva, e com que ícone aparece na lista. */
const POR_TIPO: Record<TipoNotificacao, { rota: string; Icone: typeof Bell }> = {
  parcela: { rota: "/parcelas", Icone: Layers },
  fixa: { rota: "/despesas", Icone: Repeat },
  fatura: { rota: "/cartoes", Icone: CreditCard },
};

/** Sino do header: quanto está vencido e por pagar, agora.
 *
 *  Sem "marcar como lido" nem nada gravado — a lista é o retrato do momento.
 *  Paga-se a parcela ou a fatura e ela sai daqui sozinha, porque deixa de
 *  bater na condição. Ver `utils/notificacoes.ts`. */
export default function NotificacoesSino() {
  const [aberta, setAberta] = useState(false);
  const navegar = useNavigate();
  const moeda = useCfgStore((s) => s.cfg.currency);
  const notificacoes = useNotificacoes();

  function abrir(rota: string) {
    setAberta(false);
    navegar(rota);
  }

  return (
    <>
      <button
        className={estilosHeader.acao}
        onClick={() => setAberta(true)}
        aria-label={
          notificacoes.length === 0
            ? "Lembretes — nada em atraso"
            : `Lembretes — ${notificacoes.length} em atraso`
        }
      >
        <span className={styles.envolvente}>
          <Bell size={17} aria-hidden />
          {notificacoes.length > 0 && (
            <span className={styles.badge} aria-hidden>
              {notificacoes.length}
            </span>
          )}
        </span>
      </button>

      <BottomSheet aberta={aberta} aoFechar={() => setAberta(false)} titulo="Lembretes">
        {notificacoes.length === 0 ? (
          <EstadoVazio
            Icone={BellOff}
            mensagem="Tudo em dia"
            sub="Parcelas, despesas fixas e faturas vencidas aparecem aqui."
          />
        ) : (
          <div className={styles.lista}>
            {notificacoes.map((n) => {
              const { rota, Icone } = POR_TIPO[n.tipo];
              return (
                <button key={n.id} className={styles.linha} onClick={() => abrir(rota)}>
                  <span className={styles.icone}>
                    <Icone size={16} aria-hidden />
                  </span>
                  <span className={styles.texto}>
                    <span className={styles.titulo}>{n.titulo}</span>
                    <span className={styles.detalhe}>
                      {n.diasAtraso === 1 ? "há 1 dia" : `há ${n.diasAtraso} dias`}
                      {n.detalhe ? ` · ${n.detalhe}` : ""}
                    </span>
                  </span>
                  <span className={styles.valor}>{formatMoney(n.valor, moeda)}</span>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
