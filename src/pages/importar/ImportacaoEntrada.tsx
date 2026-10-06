import { useRef, useState } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import styles from "../Importar.module.css";

/** Estado vazio da importação: escolher o extrato. "Carregar arquivo" é o
 *  caminho principal (PDF ou CSV do banco); "Colar texto" é o secundário e só
 *  abre a caixa de texto quando escolhido. No computador, a caixa inteira
 *  também aceita o ficheiro arrastado (e colado). Só apresentação: toda a
 *  lógica vem de `useImportacao`. */
export default function ImportacaoEntrada({
  texto,
  setTexto,
  arrastando,
  lendoPdf,
  semMouse,
  aoArrastarPorCima,
  aoSairDoArrasto,
  aoSoltar,
  aoColar,
  aoCarregarArquivo,
  onColarClipboard,
  onAnalisar,
}: {
  texto: string;
  setTexto: (texto: string) => void;
  arrastando: boolean;
  lendoPdf: boolean;
  semMouse: boolean;
  aoArrastarPorCima: (e: React.DragEvent) => void;
  aoSairDoArrasto: (e: React.DragEvent) => void;
  aoSoltar: (e: React.DragEvent) => void;
  aoColar: (e: React.ClipboardEvent) => void;
  aoCarregarArquivo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onColarClipboard: () => void;
  onAnalisar: () => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Com texto já no rascunho (trocou de aba e voltou), a caixa abre sozinha.
  const [colando, setColando] = useState(false);
  const caixaAberta = colando || texto.trim() !== "";

  return (
    <div
      className={`${styles.entrada} ${arrastando ? styles.entradaArrastando : ""} ${
        lendoPdf ? styles.entradaLendo : ""
      }`}
      onDragOver={aoArrastarPorCima}
      onDragLeave={aoSairDoArrasto}
      onDrop={aoSoltar}
      onPaste={aoColar}
      // Achado da auditoria de Acessibilidade: o toast "Lendo o PDF…"
      // some sozinho em 2,4s (toastStore), bem antes de um PDF grande
      // terminar — sem aria-busy, quem usa leitor de tela perde o sinal
      // de "ainda a processar" no meio do caminho.
      aria-busy={lendoPdf}
    >
      <p id="importar-entrada-titulo" className={styles.entradaTitulo}>
        Colar ou carregar extrato
      </p>
      <p id="importar-entrada-sub" className={styles.entradaSub}>
        O PDF ou CSV do banco entra por <strong>Carregar arquivo</strong>. Texto copiado de uma
        folha de cálculo entra por <strong>Colar texto</strong>.
      </p>

      <div className={styles.entradaAcoes}>
        <button
          className={styles.botaoPrimario}
          onClick={() => arquivoRef.current?.click()}
          disabled={lendoPdf}
        >
          {lendoPdf ? (
            <Loader2 size={15} className={styles.girando} aria-hidden />
          ) : (
            <Upload size={15} aria-hidden />
          )}{" "}
          {lendoPdf ? "Lendo…" : "Carregar arquivo"}
        </button>
        {!caixaAberta && (
          <button className={styles.botao} onClick={() => setColando(true)} disabled={lendoPdf}>
            Colar texto
          </button>
        )}
        <input
          ref={arquivoRef}
          type="file"
          // Extensão sozinha não basta no iOS: o seletor de Ficheiros
          // cinzenta o CSV e o PDF e não há nada para escolher. Os tipos
          // MIME ao lado são o que o iPhone realmente lê.
          accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          className={styles.arquivoOculto}
          onChange={aoCarregarArquivo}
        />
      </div>

      {caixaAberta && (
        <div className={styles.entradaColar}>
          <textarea
            className={styles.textarea}
            placeholder={"Data;Descrição;Valor\n10/07/2026;Mercado Continente;-45,90"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            aria-labelledby="importar-entrada-titulo"
            aria-describedby="importar-entrada-sub importar-entrada-formatos"
            // Quem escolheu "Colar texto" vai escrever/colar já.
            autoFocus={colando && !texto}
          />
          <div className={styles.entradaAcoes}>
            <button
              className={styles.botaoPrimario}
              onClick={onAnalisar}
              disabled={!texto.trim() || lendoPdf}
            >
              Analisar
            </button>
            {/* O botão "Colar" existe por causa do iPhone (ver
                `colarDoClipboard`): em destaque sem rato, discreto com ele. */}
            {semMouse ? (
              <button className={styles.botao} onClick={onColarClipboard} disabled={lendoPdf}>
                <ClipboardPaste size={15} aria-hidden /> Colar
              </button>
            ) : (
              <button className={styles.linkBotao} onClick={onColarClipboard} disabled={lendoPdf}>
                Colar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Área de arrastar, discreta: só onde há rato para arrastar. */}
      {!semMouse && (
        <p className={styles.entradaSoltar} aria-hidden>
          ou arraste o arquivo para aqui
        </p>
      )}
      <p id="importar-entrada-formatos" className={styles.entradaFormatos}>
        PDF do extrato, direto do banco. Ou CSV/texto delimitado (tab/;/,) com colunas de data,
        descrição e valor — exportado do banco ou colado direto de uma folha de cálculo.
      </p>
    </div>
  );
}
