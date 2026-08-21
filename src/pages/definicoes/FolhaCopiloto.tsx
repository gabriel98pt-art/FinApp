import { useState, type FormEvent } from "react";
import { Sparkles, X } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import Seletor from "../../components/Seletor";
import { definirPreferenciasCopiloto } from "../../services/cfgService";
import { mostrarToast } from "../../stores/toastStore";
import type { ConfigConta, TomCopiloto } from "../../types";
import styles from "../Definicoes.module.css";

const TONS: { valor: TomCopiloto; rotulo: string }[] = [
  { valor: "direto", rotulo: "Direto" },
  { valor: "acolhedor", rotulo: "Acolhedor" },
];

/** Personalização do Copiloto.
 *
 *  Fica desligada até alguém a ligar de propósito, e o botão de desligar
 *  apaga o nó inteiro em vez de o esvaziar — quem escreveu o nome tem de
 *  conseguir tirá-lo de lá, não só deixá-lo em branco.
 *
 *  Extraído de Definicoes.tsx sem mudar nada do comportamento — só o
 *  wrapper, que passa de `<form className={grupo}>` pra esta BottomSheet. */
export default function FolhaCopiloto({
  cfg,
  uid,
  aberta,
  aoFechar,
}: {
  cfg: ConfigConta;
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(cfg.copiloto?.nome ?? "");
  const [tom, setTom] = useState<TomCopiloto>(cfg.copiloto?.tom ?? "direto");
  const [salvando, setSalvando] = useState(false);
  const configurado = cfg.copiloto !== undefined;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await definirPreferenciasCopiloto(uid, { nome: nome.trim() || undefined, tom });
      mostrarToast("✓ Copiloto personalizado");
    } catch {
      mostrarToast("Não foi possível guardar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desligar() {
    try {
      await definirPreferenciasCopiloto(uid, null);
      setNome("");
      setTom("direto");
      mostrarToast("Personalização removida");
    } catch {
      mostrarToast("Não foi possível remover.");
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Copiloto">
      <form onSubmit={(e) => void guardar(e)}>
        <p className={styles.nota}>
          Opcional. Com um nome, o Copiloto trata-o por ele; o tom muda só o jeito das frases, nunca
          os números. Fica guardado na sua conta e sai daqui quando quiser.
        </p>
        <div className={styles.linhaAdicionar}>
          <input
            className={styles.inputPequeno}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como quer ser tratado"
            aria-label="Nome para o Copiloto"
            maxLength={40}
          />
          <Seletor
            variante="inline"
            rotulo="Tom do Copiloto"
            nivel={1}
            valor={tom}
            opcoes={TONS.map((t) => t.valor)}
            rotuloOpcao={(v) => TONS.find((t) => t.valor === v)?.rotulo ?? v}
            aoMudar={(v) => setTom(v as TomCopiloto)}
          />
          <button type="submit" className={styles.botaoPequeno} disabled={salvando}>
            <Sparkles size={14} aria-hidden /> {salvando ? "A guardar…" : "Guardar"}
          </button>
          {configurado && (
            <button type="button" className={styles.botaoPequeno} onClick={() => void desligar()}>
              <X size={14} aria-hidden /> Desligar
            </button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
