import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import styles from "./PaginaTransicao.module.css";

/** Entrada da página ao navegar. Não é um cross-fade: a página antiga sai
 *  instantaneamente e só a nova é animada — manter as duas montadas e
 *  coordenar o tempo entre elas custaria bem mais do que o ganho.
 *
 *  A `key` pela rota é o que faz o React remontar este nó a cada navegação,
 *  e é a remontagem que dispara a animação de novo. */
export default function PaginaTransicao({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className={styles.entrada}>
      {children}
    </div>
  );
}
