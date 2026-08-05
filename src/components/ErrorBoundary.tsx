import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
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
export default class ErrorBoundary extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Deixa rasto no console para quem tiver o inspetor aberto. O registo
    // persistente (para consultar depois em Definições) entra no item 2.
    console.error("Erro de render capturado pelo ErrorBoundary:", erro, info.componentStack);
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
          <button className={styles.botao} onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
