import { useState, type FormEvent } from "react";
import {
  cadastrar,
  enviarRecuperacaoSenha,
  entrar,
  mensagemDeErroAuth,
  SENHA_MINIMA,
} from "../services/authService";
import styles from "./Login.module.css";

type Modo = "entrar" | "cadastrar" | "recuperar";

const TITULO: Record<Modo, string> = {
  entrar: "Entre na sua conta",
  cadastrar: "Crie a sua conta",
  recuperar: "Recuperar a senha",
};

/** Tela de autenticação bloqueante — o app só aparece depois do login. */
export default function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  /** Troca de modo limpando o que sobrou do anterior — sem isto, o erro de
   *  "senha incorreta" ficava a acusar na tela de recuperação. */
  function irPara(novo: Modo) {
    setModo(novo);
    setErro(null);
    setAviso(null);
  }

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setAguardando(true);
    try {
      if (modo === "entrar") await entrar(email, senha);
      else if (modo === "cadastrar") await cadastrar(email, senha);
      else {
        await enviarRecuperacaoSenha(email);
        // Mensagem igual exista ou não a conta — ver enviarRecuperacaoSenha.
        setAviso("Se esse e-mail tiver conta, enviámos um link para redefinir a senha.");
      }
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
        <p className={styles.sub}>{TITULO[modo]}</p>

        <label className={styles.campo}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            // A mensagem de erro não diz QUAL campo está errado ("E-mail ou
            // senha incorretos" cobre os dois) — por isso aria-describedby
            // nos dois, não aria-invalid: marcar um campo específico como
            // inválido seria afirmar algo que não se sabe (achado da
            // auditoria de Acessibilidade).
            aria-describedby={erro !== null ? "erro-login" : undefined}
          />
        </label>

        {/* A recuperação só precisa do e-mail — pedir senha aqui não faria
            sentido nenhum, é justamente a que a pessoa não tem. */}
        {modo !== "recuperar" && (
          <label className={styles.campo}>
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              minLength={modo === "cadastrar" ? SENHA_MINIMA : 6}
              required
              aria-describedby={erro !== null ? "erro-login" : undefined}
            />
          </label>
        )}

        {erro !== null && (
          <p id="erro-login" className={styles.erro} role="alert">
            {erro}
          </p>
        )}

        {aviso !== null && (
          <p className={styles.aviso} role="status">
            {aviso}
          </p>
        )}

        <button type="submit" className={styles.principal} disabled={aguardando}>
          {aguardando
            ? "Aguarde…"
            : modo === "entrar"
              ? "Entrar"
              : modo === "cadastrar"
                ? "Cadastrar"
                : "Enviar link"}
        </button>

        {modo === "entrar" && (
          <button type="button" className={styles.alternar} onClick={() => irPara("recuperar")}>
            Esqueci a senha
          </button>
        )}

        <button
          type="button"
          className={styles.alternar}
          onClick={() => irPara(modo === "entrar" ? "cadastrar" : "entrar")}
        >
          {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
        </button>
      </form>
    </div>
  );
}
