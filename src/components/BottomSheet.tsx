import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDragToClose } from "../hooks/useDragToClose";
import styles from "./BottomSheet.module.css";

/** Bottom sheet genérica. Transição simples de opacidade+slide por padrão.
 *  `arrastavel` liga o drag-to-close com física de mola real (seção 6) —
 *  hoje só o Registro Rápido usa; modais/toast/menu "Mais" continuam com a
 *  transição CSS simples. Nunca display:none: abre/fecha por opacidade +
 *  pointer-events.
 *
 *  Renderiza num portal no `<body>`: `.folha` tem `transform`, o que ancora
 *  qualquer `position: fixed` descendente nela em vez de na janela — é o que
 *  quebraria uma folha aberta de DENTRO de outra (ex. o seletor de categoria
 *  dentro de um formulário). `nivel` empilha a folha aninhada acima da que a
 *  abriu. */
export default function BottomSheet({
  aberta,
  aoFechar,
  titulo,
  children,
  arrastavel = false,
  nivel = 0,
  tamanho = "padrao",
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  arrastavel?: boolean;
  /** 0 = folha comum; 1+ = aberta de dentro de outra folha. */
  nivel?: number;
  /** "grande" dá ~20% a mais de área — hoje só o Registro rápido usa
   *  (item 23). As demais folhas do app continuam no tamanho padrão. */
  tamanho?: "padrao" | "grande";
}) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const arrasto = useDragToClose({ folhaRef, veuRef, aoFechar });

  // O conteúdo só é construído quando a folha abre pela primeira vez — e daí
  // em diante fica, para fechar e reabrir não custar nada e a transição de
  // saída ter o que animar. O véu e a folha continuam sempre montados: são
  // duas divs, e é delas que depende a animação.
  //
  // Não é micro-otimização: cada `Seletor` traz uma folha destas com a lista
  // de opções inteira lá dentro, e a revisão de um extrato cria dois seletores
  // POR LINHA. Num extrato de 110 linhas eram 200 e tal listas completas
  // montadas de uma vez, no instante em que a análise acaba, quase todas para
  // folhas que ninguém chega a abrir. No telemóvel isso mata a página.
  const [jaAbriu, setJaAbriu] = useState(aberta);
  if (aberta && !jaAbriu) setJaAbriu(true);

  return createPortal(
    <>
      <div
        ref={veuRef}
        className={`${styles.veu} ${aberta ? styles.veuVisivel : ""}`}
        style={nivel ? { zIndex: 45 + nivel * 2 } : undefined}
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={folhaRef}
        className={`${styles.folha} ${tamanho === "grande" ? styles.folhaGrande : ""} ${
          aberta ? styles.aberta : ""
        }`}
        style={nivel ? { zIndex: 46 + nivel * 2 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!aberta}
      >
        {arrastavel ? (
          <div
            className={styles.zonaArrasto}
            onPointerDown={arrasto.aoPointerDown}
            onPointerMove={arrasto.aoPointerMove}
            onPointerUp={arrasto.aoPointerUp}
            onPointerCancel={arrasto.aoPointerCancel}
          >
            <div className={styles.pegador} aria-hidden />
            <h2 className={styles.titulo}>{titulo}</h2>
          </div>
        ) : (
          <>
            <div className={styles.pegador} aria-hidden />
            <h2 className={styles.titulo}>{titulo}</h2>
          </>
        )}
        {jaAbriu && children}
      </div>
    </>,
    document.body,
  );
}
