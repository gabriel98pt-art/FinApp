import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import BottomSheet from "./BottomSheet";
import FolhaAncorada from "./FolhaAncorada";
import styles from "./Seletor.module.css";

/** Seletor do app, no lugar do `<select>` nativo: um gatilho com o valor atual
 *  e a lista completa numa folha, cada opção uma linha clicável — nunca abre o
 *  seletor do sistema. Serve pra qualquer lista de textos (cartões, categorias,
 *  moedas, ações de importação…).
 *
 *  `SeletorCategoria` é este componente com o círculo colorido por baixo. */
export default function Seletor({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  rotuloOpcao,
  rotuloVazio,
  nivel = 1,
  renderIcone,
  aviso,
  desativado = false,
  variante = "campo",
  className,
}: {
  /** Título da folha e nome acessível do gatilho. */
  rotulo: string;
  valor: string;
  opcoes: string[];
  aoMudar: (valor: string) => void;
  /** Quando o texto mostrado difere do valor guardado (ex. "credit" → "Crédito"). */
  rotuloOpcao?: (valor: string) => string;
  /** Quando definido, a lista ganha uma opção que limpa a escolha (valor ""). */
  rotuloVazio?: string;
  /** A folha do seletor quase sempre abre de dentro de outra folha. */
  nivel?: number;
  /** Desenho à esquerda de cada opção (o círculo da categoria, por ex.). */
  renderIcone?: (valor: string, tamanho: number) => ReactNode;
  /** Texto mostrado na folha quando não há nenhuma opção. */
  aviso?: string;
  desativado?: boolean;
  /** "campo" = rótulo em cima, ocupa a largura toda. "inline" = compacto, sem
   *  rótulo visível (quem embute já mostra o nome ao lado). */
  variante?: "campo" | "inline";
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const texto = (v: string) => (rotuloOpcao ? rotuloOpcao(v) : v);

  function escolher(v: string) {
    aoMudar(v);
    setAberta(false);
  }

  const opcoesLista = (
    <>
      <ul className={styles.lista}>
        {rotuloVazio && (
          <li>
            <button
              type="button"
              className={`${styles.opcao} ${valor === "" ? styles.opcaoAtiva : ""}`}
              onClick={() => escolher("")}
            >
              {renderIcone && <span className={styles.semIcone} aria-hidden />}
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
              {renderIcone?.(o, 30)}
              <span className={styles.nome}>{texto(o)}</span>
              {o === valor && <Check size={16} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {opcoes.length === 0 && aviso && <p className={styles.aviso}>{aviso}</p>}
    </>
  );

  // "inline" é a variante das listas densas — a revisão do extrato, onde há um
  // seletor por linha e o ponteiro já está em cima dele. "campo" é o seletor de
  // formulário, que vive dentro de uma folha e continua a abrir outra folha.
  const conteudo =
    variante === "inline" ? (
      <FolhaAncorada
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        titulo={rotulo}
        nivel={nivel}
        ancoraRef={gatilhoRef}
      >
        {opcoesLista}
      </FolhaAncorada>
    ) : (
      <BottomSheet aberta={aberta} aoFechar={() => setAberta(false)} titulo={rotulo} nivel={nivel}>
        {opcoesLista}
      </BottomSheet>
    );

  return (
    <div
      className={`${styles.campo} ${variante === "inline" ? styles.inline : ""} ${className ?? ""}`}
    >
      {variante === "campo" && <span className={styles.rotulo}>{rotulo}</span>}
      <button
        ref={gatilhoRef}
        type="button"
        className={styles.gatilho}
        // Um segundo clique no gatilho fecha, como num `<select>`: o popover
        // não se fecha sozinho neste caso, para o clique de fora não competir
        // com este (ver Popover.tsx).
        onClick={() => setAberta(!aberta)}
        disabled={desativado}
        aria-expanded={aberta}
        aria-label={variante === "inline" ? rotulo : undefined}
      >
        {valor ? (
          <>
            {renderIcone?.(valor, 26)}
            <span className={styles.nome}>{texto(valor)}</span>
          </>
        ) : (
          <span className={styles.vazio}>{rotuloVazio ?? "Escolher…"}</span>
        )}
        <ChevronDown size={16} className={styles.seta} aria-hidden />
      </button>

      {conteudo}
    </div>
  );
}
