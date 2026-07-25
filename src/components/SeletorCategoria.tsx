import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import BottomSheet from "./BottomSheet";
import CategoriaBolha from "./CategoriaBolha";
import styles from "./SeletorCategoria.module.css";

/** Seletor de categoria do app, no lugar do `<select>` nativo (item 19):
 *  um gatilho com o círculo colorido + emoji + nome, e a lista completa numa
 *  folha, cada opção uma linha clicável.
 *
 *  Serve pra qualquer lista de nomes (categorias de despesa fixa/corrente/
 *  veículo e fontes de receita) — a aparência vem de `cfg` pelo nome. */
export default function SeletorCategoria({
  rotulo = "Categoria",
  valor,
  opcoes,
  aoMudar,
  rotuloVazio,
  nivel = 1,
}: {
  rotulo?: string;
  valor: string;
  opcoes: string[];
  aoMudar: (valor: string) => void;
  /** Quando definido, a lista ganha uma opção que limpa a escolha (valor ""). */
  rotuloVazio?: string;
  /** A folha do seletor quase sempre abre de dentro de outra folha. */
  nivel?: number;
}) {
  const [aberta, setAberta] = useState(false);

  function escolher(v: string) {
    aoMudar(v);
    setAberta(false);
  }

  return (
    <div className={styles.campo}>
      <span className={styles.rotulo}>{rotulo}</span>
      <button type="button" className={styles.gatilho} onClick={() => setAberta(true)}>
        {valor ? (
          <>
            <CategoriaBolha categoria={valor} tamanho={26} />
            <span className={styles.nome}>{valor}</span>
          </>
        ) : (
          <span className={styles.vazio}>{rotuloVazio ?? "Escolher…"}</span>
        )}
        <ChevronDown size={16} className={styles.seta} aria-hidden />
      </button>

      <BottomSheet aberta={aberta} aoFechar={() => setAberta(false)} titulo={rotulo} nivel={nivel}>
        <ul className={styles.lista}>
          {rotuloVazio && (
            <li>
              <button
                type="button"
                className={`${styles.opcao} ${valor === "" ? styles.opcaoAtiva : ""}`}
                onClick={() => escolher("")}
              >
                <span className={styles.semBolha} aria-hidden />
                <span className={styles.nome}>{rotuloVazio}</span>
                {valor === "" && <Check size={16} aria-hidden />}
              </button>
            </li>
          )}
          {opcoes.map((o) => (
            <li key={o}>
              <button
                type="button"
                className={`${styles.opcao} ${o === valor ? styles.opcaoAtiva : ""}`}
                onClick={() => escolher(o)}
              >
                <CategoriaBolha categoria={o} tamanho={30} />
                <span className={styles.nome}>{o}</span>
                {o === valor && <Check size={16} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        {opcoes.length === 0 && (
          <p className={styles.aviso}>Nenhuma categoria ainda — crie em Definições.</p>
        )}
      </BottomSheet>
    </div>
  );
}
