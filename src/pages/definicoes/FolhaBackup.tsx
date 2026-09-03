import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
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

  // Colar o ficheiro copiado (ex. do Finder/Explorer) direto na folha, sem
  // precisar abrir o seletor — pedido do Gabriel (03/09/2026). Ouve na
  // `window`, não num campo específico: a folha não tem nenhum campo de
  // texto onde clicar antes, ao contrário do "colar" de Importar extrato
  // (que pousa no textarea do CSV). Só ouve enquanto a folha está aberta —
  // `aberta` na dependência garante que o listener sai com ela.
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
      <p className={styles.nota}>
        Exporte todos os dados desta conta, ou restaure de um arquivo — escolhido ou colado com ⌘V.
      </p>
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
