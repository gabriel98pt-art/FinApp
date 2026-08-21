import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { exportarBackup, importarBackup } from "../../services/backupService";
import { useConfirmar } from "../../hooks/useConfirmar";
import { mostrarToast } from "../../stores/toastStore";
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

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
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
        mostrarToast(err instanceof Error ? err.message : "Backup inválido.");
      } finally {
        setImportando(false);
      }
    };
    leitor.readAsText(arquivo);
  }

  return (
    <BottomSheet aberta={aberta} aoFechar={aoFechar} titulo="Backup">
      <p className={styles.nota}>Exporte todos os dados desta conta, ou restaure de um arquivo.</p>
      <div className={styles.linhaAdicionar}>
        <button className={styles.botaoPequeno} onClick={() => void exportar()}>
          <Download size={14} aria-hidden /> Exportar dados
        </button>
        <button
          className={styles.botaoPequeno}
          onClick={() => arquivoRef.current?.click()}
          disabled={importando}
        >
          <Upload size={14} aria-hidden /> {importando ? "Importando…" : "Importar dados"}
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
