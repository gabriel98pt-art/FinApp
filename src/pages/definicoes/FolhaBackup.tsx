import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Download, Upload } from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import Botao from "../../components/Botao";
import {
  exportarBackup,
  importarBackup,
  validarArquivoBackup,
  type ResumoBackup,
} from "../../services/backupService";
import { mostrarToast } from "../../stores/toastStore";
import { mensagemDeErroDados } from "../../utils/erroDados";
import styles from "../Definicoes.module.css";

/** Estado da restauração dentro da folha. O arquivo é lido e validado LOGO
 *  que entra (escolhido, arrastado ou colado); a confirmação só aparece
 *  depois, já com o resumo do que vai entrar — nunca se confirma às cegas um
 *  arquivo que ainda nem foi aberto. */
type EtapaRestauracao =
  | { tipo: "ocioso" }
  | { tipo: "verificando" }
  | { tipo: "invalido"; erro: string }
  | { tipo: "valido"; json: string; resumo: ResumoBackup };

function lerComoTexto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ""));
    leitor.onerror = () => reject(leitor.error ?? new Error("Falha ao ler o arquivo."));
    leitor.readAsText(arquivo);
  });
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "Backup de 12 de agosto de 2026, 10:00. 7 lançamentos, 2 contas, …" */
function descreverResumo(resumo: ResumoBackup): { titulo: string; detalhe: string } {
  const titulo = resumo.exportadoEm
    ? `Backup de ${new Date(resumo.exportadoEm).toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      })}`
    : "Backup sem data de exportação";
  const partes = [plural(resumo.totalLancamentos, "lançamento", "lançamentos")];
  if (resumo.contas !== null) partes.push(plural(resumo.contas, "conta", "contas"));
  if (resumo.categorias !== null) partes.push(plural(resumo.categorias, "categoria", "categorias"));
  return { titulo, detalhe: partes.join(" · ") };
}

/** Exportar/importar o backup completo da conta (JSON de `fin_v5` inteiro),
 *  numa BottomSheet aberta pela linha "Backup >" de Definições.
 *
 *  Restaurar: o arquivo é validado por inteiro antes de qualquer pergunta; se
 *  for válido, a folha mostra o resumo (data, nº de lançamentos/contas/
 *  categorias) com "Restaurar backup" e "Cancelar". `importarBackup` guarda
 *  uma cópia de segurança dos dados atuais antes de sobrescrever. */
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
  const [etapa, setEtapa] = useState<EtapaRestauracao>({ tipo: "ocioso" });
  /** Conta as leituras: se a pessoa soltar um segundo arquivo antes de o
   *  primeiro acabar de ser lido, só o resultado do último vale. */
  const leituraAtual = useRef(0);
  const importandoRef = useRef(false);

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

  const processarArquivo = useCallback(async (arquivo: File) => {
    // Com uma restauração a correr, um arquivo novo não pode trocar o que
    // está a ser gravado nem o resumo que a pessoa confirmou.
    if (importandoRef.current) return;
    const minhaLeitura = ++leituraAtual.current;
    setEtapa({ tipo: "verificando" });
    let texto: string;
    try {
      texto = await lerComoTexto(arquivo);
    } catch {
      if (minhaLeitura === leituraAtual.current)
        setEtapa({ tipo: "invalido", erro: "Não foi possível ler o arquivo." });
      return;
    }
    if (minhaLeitura !== leituraAtual.current) return;
    const resultado = validarArquivoBackup(texto);
    setEtapa(
      resultado.ok
        ? { tipo: "valido", json: texto, resumo: resultado.resumo }
        : { tipo: "invalido", erro: resultado.erro },
    );
  }, []);

  async function restaurar() {
    if (etapa.tipo !== "valido" || importandoRef.current) return;
    importandoRef.current = true;
    setImportando(true);
    try {
      await importarBackup(uid, etapa.json);
      mostrarToast("✓ Backup restaurado");
      setEtapa({ tipo: "ocioso" });
    } catch (err) {
      mostrarToast(mensagemDeErroDados(err, "Não foi possível restaurar o backup."));
    } finally {
      importandoRef.current = false;
      setImportando(false);
    }
  }

  function cancelar() {
    leituraAtual.current++;
    setEtapa({ tipo: "ocioso" });
  }

  function fechar() {
    if (!importando) cancelar();
    aoFechar();
  }

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

  const resumo = etapa.tipo === "valido" ? descreverResumo(etapa.resumo) : null;

  return (
    <BottomSheet aberta={aberta} aoFechar={fechar} titulo="Backup">
      <p className={styles.nota}>Exporte todos os dados desta conta, ou restaure de um arquivo.</p>
      <div className={styles.linhaAdicionar}>
        <button className={styles.botaoPequeno} onClick={() => void exportar()}>
          <Download size={14} aria-hidden /> Exportar dados
        </button>
      </div>
      {etapa.tipo === "valido" && resumo ? (
        <div className={styles.resumoBackup} role="group" aria-label="Confirmar restauração">
          <p className={styles.resumoBackupTitulo}>{resumo.titulo}</p>
          <p className={styles.resumoBackupDetalhe}>{resumo.detalhe}</p>
          <p className={styles.resumoBackupAviso}>
            Isto substitui os dados atuais desta conta. Antes, é criada uma cópia de segurança
            automática dos dados atuais, recuperável.
          </p>
          <div className={styles.resumoBackupAcoes}>
            <Botao variante="texto" onClick={cancelar} disabled={importando}>
              Cancelar
            </Botao>
            <Botao variante="perigoForte" onClick={() => void restaurar()} disabled={importando}>
              {importando ? "Restaurando…" : "Restaurar backup"}
            </Botao>
          </div>
        </div>
      ) : (
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
            disabled={etapa.tipo === "verificando"}
          >
            {etapa.tipo === "verificando" ? "Verificando…" : "Escolher arquivo"}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".json"
            className={styles.arquivoOculto}
            onChange={(e) => void aoEscolherArquivo(e)}
          />
          {etapa.tipo === "invalido" && (
            <p className={styles.erroBackup} role="alert">
              {etapa.erro}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
