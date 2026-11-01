import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import Botao from "../../components/Botao";
import { apagarConta, mensagemDeErroSenhaAtual } from "../../services/authService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { mostrarToast } from "../../stores/toastStore";
import styles from "./FolhaConta.module.css";

/** Apagar a conta — o direito ao apagamento.
 *
 *  Pede a senha e ainda assim confirma: é a única ação da app que destrói
 *  dados sem qualquer forma de recuperar, nem por backup. Vive em «Minha
 *  conta» (era a secção «Conta» de Definições). */
export default function ApagarConta() {
  const [senha, setSenha] = useState("");
  const [apagando, setApagando] = useState(false);
  const confirmar = useConfirmar();

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (apagando) return;
    if (
      !(await confirmar(
        "Apagar a conta? Isto remove DEFINITIVAMENTE todos os seus dados — lançamentos, cartões, parcelas, metas e configurações. Não há como desfazer, e nem o backup recupera o que for apagado aqui.",
      ))
    )
      return;

    setApagando(true);
    try {
      await apagarConta(senha);
      // Sem toast de sucesso: o Firebase encerra a sessão e o app volta ao login.
    } catch (err) {
      mostrarToast(mensagemDeErroSenhaAtual(err));
      setApagando(false);
    }
  }

  return (
    <form className={styles.grupo} onSubmit={(e) => void submeter(e)}>
      <p className={styles.grupoTitulo}>Apagar conta</p>
      <p className={styles.nota}>
        Remove a conta e todos os dados guardados nela, sem volta. Se quiser ficar com uma cópia,
        exporte o backup antes.
      </p>
      <div className={styles.linha}>
        <input
          className={styles.input}
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          aria-label="Senha para apagar a conta"
          autoComplete="current-password"
          required
        />
        <Botao type="submit" variante="perigoForte" disabled={apagando}>
          <Trash2 size={14} aria-hidden /> {apagando ? "A apagar…" : "Apagar conta"}
        </Botao>
      </div>
    </form>
  );
}
