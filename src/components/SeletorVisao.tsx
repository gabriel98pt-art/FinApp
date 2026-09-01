import type { ReactNode } from "react";
import { useRadiogroupTeclado } from "../hooks/useRadiogroupTeclado";
import styles from "./SeletorVisao.module.css";

const OPCOES = [
  ["mes", "Mês"],
  ["semana", "Semana"],
] as const satisfies readonly (readonly ["mes" | "semana", string])[];

/** Alternador "Mês / Semana" acima de uma lista (item 10) — o mesmo par de
 *  botões que Despesas correntes e Veículo › Carregamentos já mostravam com
 *  markup próprio. Não persiste: sair da tela volta a "Mês".
 *
 *  `children` é o que fica ao lado do alternador na mesma linha — na prática
 *  o `SeletorSemana`, que só aparece com "Semana" escolhida, e é o chamador
 *  quem decide isso.
 *
 *  Nasceu ao dar a Receitas o mesmo sistema que Despesas já tinha: em vez de
 *  uma terceira cópia do mesmo markup e do mesmo CSS numa página, a cópia
 *  passou a componente. Despesas e Veículo continuam com a versão à mão
 *  delas — migrá-las é um passo à parte, para não misturar extração de código
 *  com mudança de comportamento. */
export default function SeletorVisao({
  valor,
  aoMudar,
  children,
}: {
  valor: "mes" | "semana";
  aoMudar: (v: "mes" | "semana") => void;
  children?: ReactNode;
}) {
  const { ref, onKeyDown } = useRadiogroupTeclado<HTMLDivElement>();

  return (
    <div className={styles.linha}>
      <div
        className={styles.alternador}
        role="radiogroup"
        aria-label="Período"
        ref={ref}
        onKeyDown={onKeyDown}
      >
        {OPCOES.map(([id, nome]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={valor === id}
            className={`${styles.opcao} ${valor === id ? styles.ativa : ""}`}
            onClick={() => aoMudar(id)}
          >
            {nome}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
