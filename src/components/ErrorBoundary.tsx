import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { registrarErro } from "../services/erroService";
import { useAuthStore } from "../stores/authStore";
import styles from "./ErrorBoundary.module.css";

/** Rede de segurança contra a tela branca: uma exceção durante o render
 *  desmonta a árvore React inteira, e sem isto o utilizador fica a olhar para
 *  nada — sem mensagem, sem saída, sem saber se perdeu dados.
 *
 *  Tem de ser class component: `componentDidCatch`/`getDerivedStateFromError`
 *  não têm equivalente em hook.
 *
 *  Visual deliberadamente igual ao ErroSincronizacao (ícone num círculo,
 *  mensagem, sub, botão), em vermelho em vez de amarelo: é o mesmo padrão de
 *  "algo correu mal, aqui está a saída", mas para um crash de render em vez de
 *  uma sincronização caída.
 *
 *  Recarregar é a saída certa: o estado em memória que provocou o erro
 *  desaparece e os dados vêm de novo do Firebase — nada se perde. */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { erro: boolean; mensagem?: string; primeiroComponente?: string }
> {
  state: { erro: boolean; mensagem?: string; primeiroComponente?: string } = { erro: false };

  // A mensagem crua do erro (ex. "Cannot read properties of undefined
  // (reading 'metodos')") aparece na própria tela — pequena, ao lado do botão
  // de recarregar. Sem isto, um crash preso (recarregar não sai do mesmo
  // erro) só se diagnostica com acesso ao dispositivo: quem crashou tinha de
  // descrever de memória o que viu, ou nem conseguia chegar a Definições →
  // Erros recentes para copiar a pilha de lá. Com a mensagem já na tela,
  // basta ler ou tirar print.
  static getDerivedStateFromError(erro: Error) {
    return { erro: true, mensagem: erro.message || undefined };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Deixa rasto no console para quem tiver o inspetor aberto…
    console.error("Erro de render capturado pelo ErrorBoundary:", erro, info.componentStack);
    // O primeiro "at Componente" do componentStack — qual componente estava
    // a renderizar quando rebentou. Só faz sentido ler (e o `keepNames` do
    // vite.config existe por causa disto) porque a minificação por omissão
    // trocava isto por uma letra sem significado nenhum.
    const primeiraLinha = info.componentStack?.trim().split("\n")[0]?.trim();
    // …e grava na conta, para poder ser consultado depois em Definições. É a
    // mesma função da captura global (useCapturarErros): o registo vive num
    // sítio só. Sem sessão não há onde gravar — fica só o console.
    // `getState()` em vez do hook: isto é um class component.
    const uid = useAuthStore.getState().sessao?.uid;
    this.setState({ primeiroComponente: primeiraLinha });
    if (!uid) return;
    void registrarErro(uid, {
      mensagem: erro.message || "Erro de render sem mensagem",
      pilha: erro.stack ?? info.componentStack ?? undefined,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className={styles.ecra}>
        <div className={styles.caixa} role="alert">
          <span className={styles.icone}>
            <AlertTriangle size={26} aria-hidden />
          </span>
          <p className={styles.mensagem}>Algo correu mal</p>
          <p className={styles.sub}>Tente recarregar a página.</p>
          {this.state.mensagem && <p className={styles.detalhe}>{this.state.mensagem}</p>}
          {this.state.primeiroComponente && (
            <p className={styles.detalhe}>{this.state.primeiroComponente}</p>
          )}
          <button className={styles.botao} onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
