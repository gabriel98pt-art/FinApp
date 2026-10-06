import { useRef } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import styles from "../Importar.module.css";

/** Caixa de entrada do extrato (colar texto, arrastar/colar ficheiro ou
 *  carregar pelo botão). Só apresentação: toda a lógica vem de `useImportacao`. */
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
      {/* Três degraus, por esta ordem: o que fazer (título), como (uma frase)
          e o que é suportado (linha miúda de formatos, por baixo dos botões —
          é consulta, não instrução). */}
      <p id="importar-entrada-titulo" className={styles.entradaTitulo}>
        Colar ou carregar extrato
      </p>
      <p id="importar-entrada-sub" className={styles.entradaSub}>
        Um PDF abre-se pelo botão <strong>Carregar arquivo</strong> (no computador também se arrasta
        para aqui); texto copiado entra pelo botão <strong>Colar</strong>.
      </p>
      <textarea
        className={styles.textarea}
        placeholder={"Data;Descrição;Valor\n10/07/2026;Mercado Continente;-45,90"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        aria-labelledby="importar-entrada-titulo"
        aria-describedby="importar-entrada-sub importar-entrada-formatos"
      />
      <div className={styles.entradaAcoes}>
        <button
          className={styles.botaoPrimario}
          onClick={onAnalisar}
          disabled={!texto.trim() || lendoPdf}
        >
          Analisar
        </button>
        {semMouse ? (
          <button className={styles.botao} onClick={onColarClipboard} disabled={lendoPdf}>
            <ClipboardPaste size={15} aria-hidden /> Colar
          </button>
        ) : (
          <button className={styles.linkBotao} onClick={onColarClipboard} disabled={lendoPdf}>
            Colar
          </button>
        )}
        <button
          className={styles.botao}
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
      <p id="importar-entrada-formatos" className={styles.entradaFormatos}>
        PDF do extrato, direto do banco. Ou CSV/texto delimitado (tab/;/,) com colunas de data,
        descrição e valor — exportado do banco ou colado direto de uma folha de cálculo.
      </p>
    </div>
  );
}
