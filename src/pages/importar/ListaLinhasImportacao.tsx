import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Currency, LinhaAnalisada } from "../../types";
import { GRUPOS, plural, type GrupoLinha, type StatusLinha } from "./agrupamento";
import LinhaImportacao from "./LinhaImportacao";
import styles from "../Importar.module.css";

export interface GrupoVisivel {
  id: GrupoLinha;
  rotulo: string;
  linhas: LinhaAnalisada[];
}

/** Os grupos recolhíveis da revisão — Atenção, Duplicatas, Prontos, por esta
 *  ordem — com a contagem no cabeçalho e uma `LinhaImportacao` compacta por
 *  item. Atenção começa aberto; os outros dois, recolhidos. Com um segmento
 *  do topo escolhido (`forcarAbertos`), o grupo filtrado mostra-se aberto —
 *  filtrar e ainda ter de abrir o grupo seria um passo a mais. */
export default function ListaLinhasImportacao({
  grupos,
  forcarAbertos,
  currency,
  temContas,
  modo,
  idEditor,
  idAtivo,
  statusDe,
  aoSelecionar,
  aoMudar,
  editorInline,
}: {
  grupos: GrupoVisivel[];
  forcarAbertos: boolean;
  currency: Currency;
  temContas: boolean;
  modo: "detalhe" | "inline";
  idEditor: string;
  idAtivo: number | null;
  statusDe: (l: LinhaAnalisada) => StatusLinha;
  aoSelecionar: (id: number) => void;
  aoMudar: (id: number, mudancas: Partial<LinhaAnalisada>, status: StatusLinha) => void;
  /** No modo "inline", o editor que abre por baixo da linha ativa. */
  editorInline: (l: LinhaAnalisada) => ReactNode;
}) {
  const base = useId();
  const [abertos, setAbertos] = useState<Record<GrupoLinha, boolean>>(
    () =>
      Object.fromEntries(GRUPOS.map((g) => [g.id, g.abertoPorPadrao])) as Record<
        GrupoLinha,
        boolean
      >,
  );

  return (
    <div className={styles.grupos}>
      {grupos.length === 0 && <p className={styles.listaVazia}>Nenhuma linha neste filtro.</p>}
      {grupos.map((g) => {
        const aberto = forcarAbertos || abertos[g.id];
        const idLista = `${base}-${g.id}`;
        return (
          <section key={g.id} className={styles.grupo} aria-label={g.rotulo}>
            <button
              type="button"
              className={styles.grupoCabecalho}
              aria-expanded={aberto}
              aria-controls={idLista}
              onClick={() => setAbertos((a) => ({ ...a, [g.id]: !aberto }))}
            >
              <ChevronDown
                size={16}
                aria-hidden
                className={`${styles.grupoSeta} ${aberto ? "" : styles.grupoSetaFechada}`}
              />
              <span>{g.rotulo}</span>
              <span className={styles.grupoContagem}>
                {plural(g.linhas.length, "linha", "linhas")}
              </span>
            </button>
            {aberto && (
              <ul id={idLista} className={styles.lista}>
                {g.linhas.map((l) => (
                  <li key={l.id} className={styles.listaItem}>
                    <LinhaImportacao
                      l={l}
                      currency={currency}
                      temContas={temContas}
                      status={statusDe(l)}
                      selecionada={l.id === idAtivo}
                      modo={modo}
                      idEditor={idEditor}
                      aoSelecionar={aoSelecionar}
                      aoMudar={aoMudar}
                    />
                    {modo === "inline" && l.id === idAtivo && editorInline(l)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
