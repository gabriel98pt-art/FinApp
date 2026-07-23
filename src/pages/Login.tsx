import { useState, type FormEvent } from "react";
import { cadastrar, entrar, mensagemDeErroAuth } from "../services/authService";
import styles from "./Login.module.css";

type Modo = "entrar" | "cadastrar";

/** Tela de autenticação bloqueante — o app só aparece depois do login. */
export default function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      if (modo === "entrar") await entrar(email, senha);
      else await cadastrar(email, senha);
      // Sucesso: o authStore observa a sessão e troca a tela sozinho.
    } catch (err) {
      setErro(mensagemDeErroAuth(err));
    } finally {
      setAguardando(false);
    }
  }

  return (
    <div className={styles.fundo}>
      <form className={styles.cartao} onSubmit={submeter}>
        <h1 className={styles.logo}>
          Fin<span>App</span>
        </h1>
        <p className={styles.sub}>
          {modo === "entrar" ? "Entre na sua conta" : "Crie a sua conta"}
        </p>

        <label className={styles.campo}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className={styles.campo}>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </label>

        {erro !== null && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className={styles.principal} disabled={aguardando}>
          {aguardando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Cadastrar"}
        </button>

        <button
          type="button"
          className={styles.alternar}
          onClick={() => {
            setModo(modo === "entrar" ? "cadastrar" : "entrar");
            setErro(null);
          }}
        >
          {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
        </button>
      </form>
    </div>
  );
}
