import { useState } from "react";
import { Upload } from "lucide-react";
import { EstadoVazio } from "./Pagina";
import Seletor from "./Seletor";
import { importarBackupAntigo, type AcaoDominio } from "../services/importarBackupAntigoService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useEventosStore } from "../stores/eventosStore";
import { useFundosStore } from "../stores/fundosStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { mostrarToast } from "../stores/toastStore";
import { useTvdeStore } from "../stores/tvdeStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mesAtual } from "../utils/calculos";
import {
  mapearBackupCompleto,
  resumoPorDominio,
  validarSchemaFinV4,
  type DominiosMapeados,
  type LinhaResumoImportacao,
} from "../utils/importarBackupAntigo";
import type { BackupFinV4 } from "../types";
import stylesImportar from "../pages/Importar.module.css";
import styles from "./ImportarBackupAntigo.module.css";

/** Domínios com contagem "oficial" no `_counts` do próprio export — usado só
 *  pra mostrar a nota de conferência quando o número importado diverge (ex.
 *  despesasCorrentes exclui os espelhos do veículo, ver comentário no util). */
const CONTAGEM_ARQUIVO: Partial<
  Record<keyof DominiosMapeados, keyof NonNullable<BackupFinV4["_counts"]>>
> = {
  receitas: "rec",
  despesasFixas: "df",
  despesasCorrentes: "dc",
  parcelas: "par",
  transferencias: "trf",
  eventos: "evt",
  fundos: "fnds",
  veiculoCargas: "veh_cg",
  veiculoDespesas: "veh_lp",
};

const ROTULO_ACAO: Record<AcaoDominio, string> = {
  importar: "Importar",
  somar: "Somar",
  pular: "Não importar",
};

function acaoPadrao(
  chave: keyof DominiosMapeados,
  quantidadeArquivo: number,
  quantidadeExistente: number,
): AcaoDominio {
  if (quantidadeArquivo === 0) return "pular";
  if (chave === "cfg" || chave === "tvdeCfg") return "importar";
  return quantidadeExistente === 0 ? "importar" : "pular";
}

export default function ImportarBackupAntigo() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const pedirConfirmacao = useConfirmar();
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const eventos = useEventosStore((s) => s.itens);
  const fundos = useFundosStore((s) => s.itens);
  const veiculo = useVeiculoStore((s) => s.dados);
  const tvde = useTvdeStore((s) => s.dados);

  const [mapeado, setMapeado] = useState<DominiosMapeados | null>(null);
  const [bruto, setBruto] = useState<BackupFinV4 | null>(null);
  const [linhas, setLinhas] = useState<LinhaResumoImportacao[] | null>(null);
  const [acoes, setAcoes] = useState<Partial<Record<keyof DominiosMapeados, AcaoDominio>>>({});
  const [enviando, setEnviando] = useState(false);

  const existentes: Record<keyof DominiosMapeados, number> = {
    receitas: receitas.length,
    despesasFixas: despesasFixas.length,
    despesasCorrentes: despesas.length,
    parcelas: parcelas.length,
    transferencias: transferencias.length,
    eventos: eventos.length,
    fundos: fundos.length,
    veiculoCargas: veiculo.cargas.length,
    veiculoQuilometragem: veiculo.quilometragem.length,
    veiculoDespesas: veiculo.despesas.length,
    veiculoDespesasFixas: veiculo.despesasFixas.length,
    tvdeSemanas: Object.keys(tvde.semanas).length,
    tvdeSegPorMes: Object.keys(tvde.segPorMes).length,
    tvdeLancamentos: Object.keys(tvde.lancamentos).length,
    tvdeDespesas: tvde.despesas.length,
    tvdeCfg: 0,
    cfg: 0,
  };

  function processarArquivo(conteudo: string) {
    let json: unknown;
    try {
      json = JSON.parse(conteudo);
    } catch {
      mostrarToast("Arquivo não é um JSON válido.");
      return;
    }
    if (!validarSchemaFinV4(json)) {
      mostrarToast("Esse arquivo não é um backup do app antigo (schema fin_v4 não encontrado).");
      return;
    }
    const m = mapearBackupCompleto(json, mesAtual());
    const novasAcoes: Partial<Record<keyof DominiosMapeados, AcaoDominio>> = {};
    for (const l of resumoPorDominio(m)) {
      novasAcoes[l.chave] = acaoPadrao(l.chave, l.quantidade, existentes[l.chave]);
    }
    novasAcoes.cfg = Object.keys(m.cfg).length > 0 ? "importar" : "pular";
    novasAcoes.tvdeCfg = Object.keys(m.tvdeCfg).length > 0 ? "importar" : "pular";
    setBruto(json);
    setMapeado(m);
    setLinhas(resumoPorDominio(m));
    setAcoes(novasAcoes);
  }

  function aoCarregarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => processarArquivo(String(leitor.result ?? ""));
    leitor.readAsText(arquivo);
  }

  function reiniciar() {
    setBruto(null);
    setMapeado(null);
    setLinhas(null);
    setAcoes({});
  }

  async function confirmar() {
    if (!uid || !mapeado) return;
    const dominiosAtivos = (
      Object.entries(acoes) as [keyof DominiosMapeados, AcaoDominio][]
    ).filter(([, a]) => a !== "pular");
    if (dominiosAtivos.length === 0) {
      mostrarToast("Nenhum domínio selecionado para importar.");
      return;
    }
    const comRisco = dominiosAtivos.filter(([chave]) => existentes[chave] > 0);
    if (comRisco.length > 0) {
      const lista = comRisco.map(([chave, a]) => `${chave} (${a})`).join(", ");
      if (
        !(await pedirConfirmacao(
          `Estes domínios já têm dados na conta e vão ser afetados: ${lista}. Continuar?`,
        ))
      )
        return;
    }
    setEnviando(true);
    try {
      const r = await importarBackupAntigo(uid, mapeado, acoes);
      if (r.falha.length === 0) {
        mostrarToast(`✓ Importação concluída — ${r.sucesso.length} domínio(s) gravado(s)`);
      } else {
        mostrarToast(
          `Importado com falhas: ${r.sucesso.length} ok, ${r.falha.length} falharam (${r.falha
            .map((f) => f.dominio)
            .join(", ")})`,
        );
      }
      reiniciar();
    } catch {
      mostrarToast("Não foi possível importar.");
    } finally {
      setEnviando(false);
    }
  }

  if (linhas === null || mapeado === null || bruto === null) {
    return (
      <div className={stylesImportar.entrada}>
        <p className={stylesImportar.entradaTitulo}>Restaurar backup do app antigo</p>
        <p className={stylesImportar.entradaSub}>
          Carregue o arquivo exportado pelo botão "Exportar" do financas.html/AppFinanceiro (schema
          fin_v4). É uma restauração única — mostra um resumo por domínio antes de gravar qualquer
          coisa.
        </p>
        <div className={stylesImportar.entradaAcoes}>
          <label className={stylesImportar.botaoPrimario}>
            <Upload size={15} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Carregar backup
            <input
              type="file"
              accept=".json"
              className={stylesImportar.arquivoOculto}
              onChange={aoCarregarArquivo}
            />
          </label>
        </div>
      </div>
    );
  }

  const totalAImportar = Object.values(acoes).filter((a) => a && a !== "pular").length;

  return (
    <>
      <div className={stylesImportar.resumo}>
        <span>
          Backup de {bruto._exportedAt ? bruto._exportedAt.slice(0, 10) : "data desconhecida"} ·{" "}
          {totalAImportar} domínio(s) selecionado(s)
        </span>
        <button className={stylesImportar.linkBotao} onClick={reiniciar}>
          Novo arquivo
        </button>
      </div>

      {linhas.every((l) => l.quantidade === 0) && Object.keys(mapeado.cfg).length === 0 ? (
        <EstadoVazio Icone={Upload} mensagem="Arquivo sem nenhum dado reconhecido" />
      ) : (
        <div className={styles.lista}>
          {linhas
            .filter((l) => l.quantidade > 0)
            .map((l) => {
              const contagemArquivo = CONTAGEM_ARQUIVO[l.chave];
              const oficial = contagemArquivo ? bruto._counts?.[contagemArquivo] : undefined;
              const divergente = oficial != null && oficial !== l.quantidade;
              return (
                <div key={l.chave} className={styles.linha}>
                  <div className={styles.linhaInfo}>
                    <p className={styles.linhaTitulo}>{l.rotulo}</p>
                    <p className={styles.linhaDetalhe}>
                      {l.quantidade} {l.quantidade === 1 ? "registro" : "registros"}
                      {divergente && ` (arquivo tem ${oficial} — resto já entra pelo veículo)`}
                      {existentes[l.chave] > 0 && ` · já existem ${existentes[l.chave]} na conta`}
                    </p>
                  </div>
                  <Seletor
                    variante="inline"
                    rotulo={`O que fazer com ${l.rotulo}`}
                    nivel={0}
                    valor={acoes[l.chave] ?? "pular"}
                    opcoes={["importar", "somar", "pular"]}
                    rotuloOpcao={(v) => ROTULO_ACAO[v as AcaoDominio]}
                    aoMudar={(v) => setAcoes((a) => ({ ...a, [l.chave]: v as AcaoDominio }))}
                  />
                </div>
              );
            })}

          {(Object.keys(mapeado.cfg).length > 0 || Object.keys(mapeado.tvdeCfg).length > 0) && (
            <div className={styles.linha}>
              <div className={styles.linhaInfo}>
                <p className={styles.linhaTitulo}>Configurações da conta</p>
                <p className={styles.linhaDetalhe}>
                  Moeda, categorias, orçamentos, saldos iniciais, cartões e config do TVDE
                </p>
              </div>
              <Seletor
                variante="inline"
                rotulo="O que fazer com as configurações da conta"
                nivel={0}
                valor={acoes.cfg ?? "pular"}
                opcoes={["importar", "pular"]}
                rotuloOpcao={(v) => ROTULO_ACAO[v as AcaoDominio]}
                aoMudar={(v) =>
                  setAcoes((a) => ({ ...a, cfg: v as AcaoDominio, tvdeCfg: v as AcaoDominio }))
                }
              />
            </div>
          )}
        </div>
      )}

      <button
        className={stylesImportar.confirmar}
        onClick={confirmar}
        disabled={enviando || totalAImportar === 0}
      >
        {enviando ? "Aguarde…" : `Confirmar importação (${totalAImportar})`}
      </button>
    </>
  );
}
