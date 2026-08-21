import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import SettingsRow from "../../components/settings/SettingsRow";
import { limparErros, observarErros, type ErroRegistado } from "../../services/erroService";
import { mostrarToast } from "../../stores/toastStore";
import styles from "../Definicoes.module.css";

/** Data legível para quem vai reportar o erro ("quinta às 14h32", não um
 *  timestamp). */
function quando(ts: number): string {
  return new Date(ts).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Os últimos erros que o app apanhou (últimos 14 dias, e no máximo 30 — ver
 *  erroService.ts), para poderem ser copiados e enviados sem depender de
 *  descrever de memória o que aconteceu. A pilha não é mostrada (ilegível na
 *  tela), mas vai inteira no "Copiar".
 *
 *  A linha inteira some quando não há nada registado — sem isto ocupava
 *  espaço numa tela de preferências mesmo vazia (era assim antes da folha
 *  também: a seção inteira desaparecia). Havendo erro, a lista mora atrás de
 *  uma folha, não solta na tela principal — é texto técnico, não algo pra
 *  saltar aos olhos de quem só veio trocar a moeda.
 *
 *  Leitura local com useState/useEffect: é a única tela que lê isto, não
 *  justifica uma store global. */
export default function FolhaDiagnostico({ uid }: { uid: string }) {
  const [erros, setErros] = useState<ErroRegistado[]>([]);
  const [aberta, setAberta] = useState(false);

  useEffect(() => observarErros(uid, setErros), [uid]);

  async function copiar(e: ErroRegistado) {
    const texto = [`${quando(e.timestamp)} — ${e.mensagem}`, e.url, e.pilha ?? ""]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast("✓ Erro copiado");
    } catch {
      mostrarToast("Não foi possível copiar.");
    }
  }

  async function limpar() {
    try {
      await limparErros(uid);
      mostrarToast("✓ Registo limpo");
    } catch {
      mostrarToast("Não foi possível limpar.");
    }
  }

  if (erros.length === 0) return null;

  return (
    <>
      <div className={styles.grupo}>
        <SettingsRow
          titulo="Diagnóstico"
          valor={`${erros.length} ${erros.length === 1 ? "erro" : "erros"}`}
          navegavel
          onClick={() => setAberta(true)}
        />
      </div>
      <BottomSheet aberta={aberta} aoFechar={() => setAberta(false)} titulo="Diagnóstico">
        <p className={styles.nota}>
          Se algo correu mal, copie o erro e envie — evita ter de o descrever de memória.
        </p>
        <div className={styles.listaErros}>
          {erros.map((e) => (
            <div key={e.id} className={styles.linhaErro}>
              <div className={styles.erroTexto}>
                <span className={styles.erroQuando}>{quando(e.timestamp)}</span>
                <span className={styles.erroMensagem}>{e.mensagem}</span>
              </div>
              <button
                className={styles.acaoCategoria}
                onClick={() => void copiar(e)}
                aria-label={`Copiar erro de ${quando(e.timestamp)}`}
              >
                <Copy size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <div className={styles.linhaAdicionar}>
          <button className={styles.botaoPequeno} onClick={() => void limpar()}>
            <Trash2 size={14} aria-hidden /> Limpar registo
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
