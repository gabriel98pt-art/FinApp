import { useState } from "react";
import { Palette } from "lucide-react";
import BottomSheet from "./BottomSheet";
import SeletorCor from "./SeletorCor";
import { ROTULO_TOKEN, TOKENS_COR_APP } from "../hooks/useAplicarCoresPersonalizadas";
import { definirCorApp } from "../services/cfgService";
import { mostrarToast } from "../stores/toastStore";
import { useThemeStore } from "../stores/themeStore";
import type { ConfigConta, TokenCorApp } from "../types";
import styles from "./PainelCoresApp.module.css";

/** As cinco cores que se repetem no app inteiro. Editar aqui muda tudo de uma
 *  vez — o item ativo da navegação, os valores positivos/negativos, os avisos.
 *
 *  Por TEMA: os tons de cada token já são diferentes entre claro e escuro, e
 *  um valor só não serviria aos dois. Quem quiser acertar o outro tema troca
 *  de tema e volta aqui. */
export default function PainelCoresApp({
  aberta,
  aoFechar,
  cfg,
  uid,
}: {
  aberta: boolean;
  aoFechar: () => void;
  cfg: ConfigConta;
  uid: string;
}) {
  const tema = useThemeStore((s) => s.theme);
  const [editando, setEditando] = useState<TokenCorApp | null>(null);
  const escolhidas = cfg.coresApp?.[tema] ?? {};

  async function escolher(cor: string | null) {
    if (!editando) return;
    const token = editando;
    setEditando(null);
    try {
      await definirCorApp(uid, tema, token, cor);
    } catch {
      mostrarToast("Não foi possível salvar a cor.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Editar cores">
      <div className={styles.painel}>
        {/* Amostra só ilustrativa: como as cores são aplicadas no <html>, ela
            (e o app por trás da folha) já mudam sozinhas ao escolher. */}
        <div className={styles.amostra}>
          <span className={styles.pilula}>Selecionado</span>
          <span className={styles.positivo}>+ € 120,00</span>
          <span className={styles.negativo}>− € 80,00</span>
          <span className={styles.alerta}>Atenção</span>
          <span className={styles.roxo} aria-hidden />
        </div>

        <p className={styles.nota}>
          Vale para o tema {tema === "dark" ? "escuro" : "claro"}. Para acertar o outro, troque de
          tema e abra este painel de novo.
        </p>

        <ul className={styles.lista}>
          {TOKENS_COR_APP.map((token) => (
            <li key={token} className={styles.linha}>
              <span className={styles.bola} style={{ background: `var(--${token})` }} aria-hidden />
              <span className={styles.nome}>{ROTULO_TOKEN[token]}</span>
              {escolhidas[token] && <span className={styles.marca}>personalizada</span>}
              <button
                className={styles.acao}
                onClick={() => setEditando(token)}
                aria-label={`Cor de ${ROTULO_TOKEN[token]}`}
                title="Escolher cor"
              >
                <Palette size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <SeletorCor
        aberta={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={editando ? `Cor de ${ROTULO_TOKEN[editando]}` : "Cor"}
        valor={editando ? (escolhidas[editando] ?? "") : ""}
        aoEscolher={(c) => void escolher(c)}
        nivel={1}
      />
    </BottomSheet>
  );
}
