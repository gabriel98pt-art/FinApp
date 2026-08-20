import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDragToClose } from "../hooks/useDragToClose";
import { useFocoModal } from "../hooks/useFocoModal";
import styles from "./BottomSheet.module.css";

// Quantas folhas estão abertas em cada nível, agora. Contador e não conjunto:
// duas folhas do mesmo nível podem estar abertas ao mesmo tempo durante a
// troca de uma pela outra. Serve para uma folha saber se tem outra por cima —
// é o que faz a folha-mãe recuar quando o seletor de categoria abre de dentro
// do formulário.
const abertasPorNivel = new Map<number, number>();
const ouvintes = new Set<() => void>();
let nivelDoTopo = -1;

function recalcularTopo() {
  let topo = -1;
  for (const [nivel, quantas] of abertasPorNivel) {
    if (quantas > 0 && nivel > topo) topo = nivel;
  }
  if (topo === nivelDoTopo) return;
  nivelDoTopo = topo;
  for (const ouvinte of ouvintes) ouvinte();
}

function subscreverTopo(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

const lerTopo = () => nivelDoTopo;

/** Bottom sheet genérica, com drag-to-close de mola real (seção 6) a partir do
 *  cabeçalho — pegador e título. Ligado por padrão: era o gesto que o Registro
 *  Rápido tinha e as outras 18 folhas do app não, sem razão nenhuma para a
 *  diferença. `arrastavel={false}` desliga numa folha específica.
 *
 *  Abrir, fechar por toque/Esc e fechar por arrasto correm todos a MESMA mola
 *  (`useDragToClose`): a folha desliza de fora da janela para dentro e de
 *  volta, e qualquer um dos três se pode interromper a meio, retomando da
 *  posição visível. Antes, só o arrasto era mola; abrir e fechar por toque
 *  eram uma transição CSS de 24px com fade, e a mesma folha saía de duas
 *  maneiras diferentes conforme como se a fechava.
 *
 *  Nunca display:none: fechada continua montada, fora da janela.
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
  arrastavel = true,
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
  // `visivel` inclui a saída: a folha continua apresentada enquanto a mola a
  // leva para fora da janela, e só depois é que o CSS a esconde.
  const { visivel, ...arrasto } = useDragToClose({ aberta, folhaRef, veuRef, aoFechar });
  const tituloId = useId();
  useFocoModal({ aberta, folhaRef, aoFechar });

  useEffect(() => {
    if (!aberta) return;
    abertasPorNivel.set(nivel, (abertasPorNivel.get(nivel) ?? 0) + 1);
    recalcularTopo();
    return () => {
      abertasPorNivel.set(nivel, (abertasPorNivel.get(nivel) ?? 1) - 1);
      recalcularTopo();
    };
  }, [aberta, nivel]);

  const topo = useSyncExternalStore(subscreverTopo, lerTopo, lerTopo);
  const recuada = aberta && topo > nivel;

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
        className={`${styles.veu} ${visivel ? styles.veuVisivel : ""}`}
        style={nivel ? { zIndex: 45 + nivel * 2 } : undefined}
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={folhaRef}
        className={`${styles.folha} ${tamanho === "grande" ? styles.folhaGrande : ""} ${
          visivel ? styles.presente : ""
        } ${recuada ? styles.recuada : ""}`}
        style={nivel ? { zIndex: 46 + nivel * 2 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        // O foco entra aqui ao abrir (useFocoModal) — daí o -1: focável por
        // código, mas fora da ordem natural do Tab.
        tabIndex={-1}
        // `inert` e não `aria-hidden`: fechada, a folha continua montada (o
        // conteúdo fica em cache depois da primeira abertura) e ficar fora da
        // janela só a tira da vista — o Tab continuava a entrar nos botões
        // invisíveis lá dentro. Pior: `aria-hidden` num contentor com focáveis
        // é ele próprio uma violação de ARIA. `inert` tira-os da navegação e
        // da árvore de acessibilidade de uma vez. Segue `aberta` e não
        // `visivel`: a partir do momento em que a aplicação a fecha, a folha
        // já não é alcançável, mesmo enquanto a mola a leva para fora.
        inert={!aberta}
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
            <h2 id={tituloId} className={styles.titulo}>
              {titulo}
            </h2>
          </div>
        ) : (
          <>
            <div className={styles.pegador} aria-hidden />
            <h2 id={tituloId} className={styles.titulo}>
              {titulo}
            </h2>
          </>
        )}
        {jaAbriu && children}
      </div>
    </>,
    document.body,
  );
}
