import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Download, Upload } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { exportarBackup, importarBackup } from "../../services/backupService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { mostrarToast } from "../../stores/toastStore";
import { mensagemDeErroDados } from "../../utils/erroDados";
import styles from "../Definicoes.module.css";

/** Exportar/importar o backup completo da conta (JSON de `fin_v5` inteiro).
 *
 *  Extraído de Definicoes.tsx sem mudar comportamento nenhum — mesmo
 *  `exportarBackup`/`importarBackup`, mesma confirmação forte antes de
 *  sobrescrever. Só o wrapper passa de `<div className={grupo}>` pra esta
 *  BottomSheet, aberta por uma linha própria ("Backup >"). */
export default function FolhaBackup({
  uid,
  aberta,
  aoFechar,
}: {
  uid: string;
  aberta: boolean;
  aoFechar: () => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const confirmar = useConfirmar();

  async function exportar() {
    try {
      const json = await exportarBackup(uid);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast("✓ Backup baixado");
    } catch {
      mostrarToast("Não foi possível exportar.");
    }
  }

  const processarArquivo = useCallback(
    async (arquivo: File) => {
      if (
        !(await confirmar(
          "Importar backup? Isto SOBRESCREVE todos os dados atuais desta conta — a ação não pode ser desfeita.",
        ))
      )
        return;
      const leitor = new FileReader();
      leitor.onload = async () => {
        setImportando(true);
        try {
          await importarBackup(uid, String(leitor.result ?? ""));
          mostrarToast("✓ Backup importado");
        } catch (err) {
          mostrarToast(mensagemDeErroDados(err, "Backup inválido."));
        } finally {
          setImportando(false);
        }
      };
      leitor.readAsText(arquivo);
    },
    [uid, confirmar],
  );

  function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void processarArquivo(arquivo);
  }

  /** Só se acende para ficheiros: arrastar texto ou uma seleção dentro da
   *  página não é o gesto que nos interessa (ver mesma função em Importar.tsx). */
  function temFicheiro(dt: DataTransfer | null) {
    return !!dt && Array.from(dt.types).includes("Files");
  }

  function aoArrastarPorCima(e: DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    e.preventDefault();
    setArrastando(true);
  }

  function aoSairDoArrasto(e: DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setArrastando(false);
  }

  function aoSoltar(e: DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) void processarArquivo(arquivo);
  }

  // Colar o ficheiro copiado (ex. do Finder/Explorer) direto na folha, sem
  // precisar abrir o seletor — pedido do Gabriel (03/09/2026). Ouve na
  // `window`, não na zona de arrastar/colar abaixo: essa zona não tem nenhum
  // campo de texto onde focar antes de colar, ao contrário do textarea de
  // Importar extrato. Só ouve enquanto a folha está aberta — `aberta` na
  // dependência garante que o listener sai com ela.
  useEffect(() => {
    if (!aberta) return;
    function aoColar(e: ClipboardEvent) {
      const arquivo = e.clipboardData?.files?.[0];
      if (!arquivo) return;
      e.preventDefault();
      void processarArquivo(arquivo);
    }
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, [aberta, processarArquivo]);

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Backup">
      <p className={styles.nota}>Exporte todos os dados desta conta, ou restaure de um arquivo.</p>
      <div className={styles.linhaAdicionar}>
        <button className={styles.botaoPequeno} onClick={() => void exportar()}>
          <Download size={14} aria-hidden /> Exportar dados
        </button>
      </div>
      <div
        className={`${styles.dropzoneBackup} ${arrastando ? styles.dropzoneBackupArrastando : ""}`}
        onDragOver={aoArrastarPorCima}
        onDragLeave={aoSairDoArrasto}
        onDrop={aoSoltar}
      >
        <Upload size={20} aria-hidden />
        <p className={styles.dropzoneBackupTexto}>
          Arraste o arquivo de backup aqui, cole com ⌘V/Ctrl+V, ou
        </p>
        <button
          className={styles.botaoPequeno}
          onClick={() => arquivoRef.current?.click()}
          disabled={importando}
        >
          {importando ? "Importando…" : "Escolher arquivo"}
        </button>
        <input
          ref={arquivoRef}
          type="file"
          accept=".json"
          className={styles.arquivoOculto}
          onChange={(e) => void aoEscolherArquivo(e)}
        />
      </div>
    </BottomSheet>
  );
}
