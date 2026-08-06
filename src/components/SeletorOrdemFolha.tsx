import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ListFilter } from "lucide-react";
import FolhaAncorada from "./FolhaAncorada";
import type { LinhaOrdem } from "../utils/ordem";
import styles from "./SeletorOrdemFolha.module.css";

/** Nome da ordem atual, para o rótulo do botão redondo. Num par diz também
 *  para que lado está — é o que a seta mostra a quem vê. */
function rotuloDaOrdem<T extends string>(linhas: LinhaOrdem<T>[], valor: T): string {
  for (const linha of linhas) {
    if (linha.tipo === "simples") {
      if (linha.valor === valor) return linha.rotulo;
    } else if (linha.desc === valor || linha.asc === valor) {
      return `${linha.rotulo}, ${linha.asc === valor ? "crescente" : "decrescente"}`;
    }
  }
  return "";
}

/** Botão redondo de ordenação + lista de opções (a atual marcada). Alternativa
 *  à fileira de botões do `SeletorOrdem` para listas com mais opções do que
 *  cabem numa linha — hoje só a tela Parcelas.
 *
 *  Critérios que existem nos dois sentidos (mais recentes/mais antigas, maior/
 *  menor valor) entram como um `par`: uma linha só, com uma seta que troca a
 *  direção a cada toque. Poupa metade das linhas sem tirar nenhuma ordem — os
 *  valores por trás continuam a ser um por direção.
 *
 *  Abre em folha no telemóvel e colado ao botão no desktop (ver
 *  `FolhaAncorada`).
 *
 *  Genérico no tipo da ordem: cada tela passa as suas linhas. */
export default function SeletorOrdemFolha<T extends string>({
  valor,
  linhas,
  aoMudar,
}: {
  valor: T;
  linhas: LinhaOrdem<T>[];
  aoMudar: (o: T) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const atual = rotuloDaOrdem(linhas, valor);

  function escolher(o: T) {
    aoMudar(o);
    setAberta(false);
  }

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        className={styles.botao}
        // Segundo clique fecha — ver a mesma nota no `Seletor`.
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        aria-label={`Ordenar por — atual: ${atual}`}
        title={`Ordenar: ${atual}`}
      >
        <ListFilter size={16} aria-hidden />
      </button>

      <FolhaAncorada
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo="Ordenar por"
        ancoraRef={gatilhoRef}
      >
        <div className={styles.opcoes} role="radiogroup" aria-label="Ordenar por">
          {linhas.map((linha) => {
            if (linha.tipo === "simples") {
              const ativa = valor === linha.valor;
              return (
                <button
                  key={linha.valor}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  className={`${styles.opcao} ${ativa ? styles.ativa : ""}`}
                  onClick={() => escolher(linha.valor)}
                >
                  <span>{linha.rotulo}</span>
                  {ativa && <Check size={16} aria-hidden />}
                </button>
              );
            }
            // Num par, a seta mostra para que lado a lista está ordenada; na
            // linha que não está escolhida ela aponta para baixo a dizer por
            // onde começa se for tocada. Tocar de novo inverte.
            const ativa = valor === linha.desc || valor === linha.asc;
            const paraCima = valor === linha.asc;
            const Seta = paraCima ? ArrowUp : ArrowDown;
            return (
              <button
                key={`${linha.desc}/${linha.asc}`}
                type="button"
                role="radio"
                aria-checked={ativa}
                aria-label={
                  ativa ? `${linha.rotulo}, ${paraCima ? "crescente" : "decrescente"}` : undefined
                }
                className={`${styles.opcao} ${ativa ? styles.ativa : ""}`}
                onClick={() => escolher(valor === linha.desc ? linha.asc : linha.desc)}
              >
                <span>{linha.rotulo}</span>
                <span className={styles.direcao}>
                  <Seta size={16} aria-hidden />
                  {ativa && <Check size={16} aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      </FolhaAncorada>
    </>
  );
}
