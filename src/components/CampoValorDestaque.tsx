import type { Cents } from "../types";
import CampoMoeda from "./CampoMoeda";
import styles from "./CampoValorDestaque.module.css";

/** Campo de valor em destaque — label pequeno em cima, número grande e
 *  centralizado embaixo. Item 4 do lote de UX/nav (30/08): o Valor deixa de
 *  ser "mais um campo" e vira o centro do formulário. Nasceu dentro do
 *  Registro Rápido; extraído em 01/09/2026 pra qualquer formulário de
 *  lançamento do app usar o mesmo padrão, em vez de cada tela reinventar o
 *  seu próprio rótulo "Valor" em estilo antigo. */
export default function CampoValorDestaque({
  rotulo = "Quanto?",
  valor,
  aoMudar,
  tom,
  required,
  disabled,
  "aria-describedby": ariaDescribedby,
}: {
  /** Por omissão "Quanto?" — troque só quando o campo pergunta outra coisa
   *  (ex.: "Preço por kWh (€)" na carga elétrica do Registro Rápido). */
  rotulo?: string;
  valor: Cents | null;
  aoMudar: (v: Cents | null) => void;
  /** "receita" pinta o número de verde — nunca fora de um lançamento de
   *  receita (regra "verde só em Receita", ver categoriaVisual.ts). */
  tom?: "receita";
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <label className={styles.campo}>
      <span className={styles.rotulo}>{rotulo}</span>
      <CampoMoeda
        valor={valor}
        aoMudar={aoMudar}
        required={required}
        disabled={disabled}
        className={`${styles.valor} ${tom === "receita" ? styles.receita : ""}`}
        aria-describedby={ariaDescribedby}
      />
    </label>
  );
}
