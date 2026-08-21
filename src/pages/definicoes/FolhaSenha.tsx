import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { alterarSenha, mensagemDeErroSenhaAtual, SENHA_MINIMA } from "../../services/authService";
import { mostrarToast } from "../../stores/toastStore";
import styles from "../Definicoes.module.css";

/** Troca de senha. Pede a atual porque o Firebase exige login recente para
 *  operações sensíveis — e porque é ela que impede que uma sessão deixada
 *  aberta num telemóvel emprestado vire uma conta perdida.
 *
 *  Extraído de Definicoes.tsx (redesign em índice+folhas) sem mudar nada do
 *  comportamento — só o wrapper, que passa de `<div className={grupo}>` para
 *  esta BottomSheet. */
export default function FolhaSenha({
  aberta,
  aoFechar,
}: {
  aberta: boolean;
  aoFechar: () => void;
}) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await alterarSenha(atual, nova);
      // Limpar antes do toast: a senha nova não fica à vista de quem estiver
      // ao lado, e o formulário não convida a submeter outra vez.
      setAtual("");
      setNova("");
      mostrarToast("✓ Senha alterada");
    } catch (err) {
      mostrarToast(mensagemDeErroSenhaAtual(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Trocar senha">
      <form onSubmit={(e) => void submeter(e)}>
        <p className={styles.nota}>
          Mínimo de {SENHA_MINIMA} caracteres. Pedimos a senha atual para confirmar que é mesmo
          você.
        </p>
        <div className={styles.linhaAdicionar}>
          <input
            className={styles.inputPequeno}
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            placeholder="Senha atual"
            aria-label="Senha atual"
            autoComplete="current-password"
            required
          />
          <input
            className={styles.inputPequeno}
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Senha nova"
            aria-label="Senha nova"
            autoComplete="new-password"
            minLength={SENHA_MINIMA}
            required
          />
          <button type="submit" className={styles.botaoPequeno} disabled={salvando}>
            <KeyRound size={14} aria-hidden /> {salvando ? "A alterar…" : "Alterar senha"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
