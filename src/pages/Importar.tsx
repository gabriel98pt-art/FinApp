import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import Pagina, { EstadoVazio } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import ImportarBackupAntigo from "../components/ImportarBackupAntigo";
import Seletor from "../components/Seletor";
import { construirExistentes, confirmarImportacao } from "../services/importacaoService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import { useDespesasStore, useReceitasStore } from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { analisarLinha } from "../utils/importacao";
import { parseExtratoCsv } from "../utils/importacaoParser";
import { extrairExtratoPdf, LeitorPdfIndisponivel } from "../utils/extrairExtratoPdf";
import { formatMoney } from "../utils/money";
import type { Confianca, DecisaoLinha, LinhaAnalisada, LinhaExtrato } from "../types";
import styles from "./Importar.module.css";

const ROTULO_DECISAO: Record<DecisaoLinha, string> = {
  auto_classificada: "Auto-classificada",
  nova: "Nova",
  duplicata_provavel: "Provável duplicata",
  revisao: "Revisão",
};

const FILTROS: { id: DecisaoLinha | "todas"; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "auto_classificada", rotulo: "Auto-classificadas" },
  { id: "nova", rotulo: "Novas" },
  { id: "duplicata_provavel", rotulo: "Prováveis duplicatas" },
  { id: "revisao", rotulo: "Revisão" },
];

function corConfianca(c: Confianca): string {
  return c === "high" ? styles.confAlta : c === "medium" ? styles.confMedia : styles.confBaixa;
}

type Aba = "extrato" | "backupAntigo";

export default function Importar() {
  const uid = useAuthStore((s) => s.sessao?.uid);
  const pedirConfirmacao = useConfirmar();
  const cfg = useCfgStore((s) => s.cfg);
  const receitas = useReceitasStore((s) => s.itens);
  const despesas = useDespesasStore((s) => s.itens);
  const parcelas = useParcelasStore((s) => s.itens);
  // Carga elétrica e despesa do veículo também são dinheiro que pode vir
  // repetido no extrato — entram na comparação de duplicatas.
  const veiculo = useVeiculoStore((s) => s.dados);

  const [aba, setAba] = useState<Aba>("extrato");
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaAnalisada[] | null>(null);
  const [filtro, setFiltro] = useState<DecisaoLinha | "todas">("todas");
  const [enviando, setEnviando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const categoriasConfiguradas = [...cfg.categoriasFixas, ...cfg.categoriasCorrentes];
  const opcoesCategoria = [
    ...new Set([...categoriasConfiguradas, "Cartão de Crédito", "Transferência", "Outros"]),
  ];

  function analisar(brutas: LinhaExtrato[]) {
    if (brutas.length === 0) {
      mostrarToast("Nenhuma linha reconhecida — confira o formato do extrato.");
      return;
    }
    const existentes = construirExistentes(receitas, despesas, veiculo.cargas, veiculo.despesas);
    const analisadas = brutas.map((tx, i) =>
      analisarLinha(tx, i, { parcelas, categoriasConfiguradas, existentes }),
    );
    setLinhas(analisadas);
    setFiltro("todas");
    mostrarToast(`${analisadas.length} linha(s) analisada(s)`);
  }

  function aoCarregarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    // PDF vai por outro caminho: lê-se em binário e a extração é assíncrona
    // (carrega o PDF.js sob demanda e percorre as páginas), daí o aviso de
    // espera — um extrato de vários meses leva um instante.
    if (/\.pdf$/i.test(arquivo.name) || arquivo.type === "application/pdf") {
      setLendoPdf(true);
      mostrarToast("Lendo o PDF…");
      void (async () => {
        try {
          analisar(await extrairExtratoPdf(await arquivo.arrayBuffer()));
        } catch (erro) {
          // O toast não pode despejar o erro em cima do usuário, mas sem ele
          // ficar registado em lado nenhum um relato de "não abriu" não dá
          // para investigar — foi o que aconteceu da última vez.
          console.error("Falha ao ler extrato em PDF:", erro);
          mostrarToast(
            erro instanceof LeitorPdfIndisponivel
              ? "O leitor de PDF não carregou. Verifique a ligação e tente de novo."
              : "Não foi possível processar este PDF.",
          );
        } finally {
          setLendoPdf(false);
        }
      })();
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => analisar(parseExtratoCsv(String(leitor.result ?? "")));
    leitor.readAsText(arquivo);
  }

  function atualizarLinha(id: number, mudancas: Partial<LinhaAnalisada>) {
    setLinhas((atual) => atual?.map((l) => (l.id === id ? { ...l, ...mudancas } : l)) ?? null);
  }

  function aceitarAutoClassificadas() {
    setLinhas(
      (atual) =>
        atual?.map((l) => (l.decisao === "auto_classificada" ? { ...l, acao: "import" } : l)) ??
        null,
    );
    mostrarToast("Auto-classificadas marcadas para importar");
  }

  function marcarTodas(acao: "import" | "skip") {
    setLinhas((atual) => atual?.map((l) => ({ ...l, acao })) ?? null);
  }

  async function confirmar() {
    if (!uid || !linhas) return;
    const aImportar = linhas.filter((l) => l.acao === "import");
    if (aImportar.length === 0) {
      mostrarToast("Nenhuma linha marcada para importar.");
      return;
    }
    setEnviando(true);
    try {
      const n = await confirmarImportacao(uid, aImportar);
      mostrarToast(`✓ ${n} lançamento(s) importado(s)`);
      setLinhas(null);
      setTexto("");
    } catch {
      mostrarToast("Não foi possível importar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const visiveis = linhas?.filter((l) => filtro === "todas" || l.decisao === filtro) ?? [];
  const totalImportar = linhas?.filter((l) => l.acao === "import").length ?? 0;

  return (
    <Pagina titulo="Importar">
      <div className={styles.abas} role="tablist">
        {(
          [
            ["extrato", "Extrato bancário"],
            ["backupAntigo", "Backup da app antiga"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={`${styles.abaBotao} ${aba === id ? styles.abaAtiva : ""}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>

      <AbaTransicao aba={aba}>
        {aba === "backupAntigo" && <ImportarBackupAntigo />}

        {aba === "extrato" &&
          (linhas === null ? (
            <div className={styles.entrada}>
              <p className={styles.entradaTitulo}>Colar ou carregar extrato</p>
              <p className={styles.entradaSub}>
                PDF do extrato, direto do banco. Ou CSV/texto delimitado (tab/;/,) com colunas de
                data, descrição e valor — exportado do banco ou colado direto de uma folha de
                cálculo.
              </p>
              <textarea
                className={styles.textarea}
                placeholder={"Data;Descrição;Valor\n10/07/2026;Mercado Continente;-45,90"}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
              />
              <div className={styles.entradaAcoes}>
                <button
                  className={styles.botaoPrimario}
                  onClick={() => analisar(parseExtratoCsv(texto))}
                  disabled={!texto.trim() || lendoPdf}
                >
                  Analisar
                </button>
                <button
                  className={styles.botao}
                  onClick={() => arquivoRef.current?.click()}
                  disabled={lendoPdf}
                >
                  <Upload size={15} aria-hidden /> {lendoPdf ? "Lendo…" : "Carregar arquivo"}
                </button>
                <input
                  ref={arquivoRef}
                  type="file"
                  accept=".csv,.txt,.pdf"
                  className={styles.arquivoOculto}
                  onChange={aoCarregarArquivo}
                />
              </div>
            </div>
          ) : linhas.length === 0 ? (
            <EstadoVazio Icone={Upload} mensagem="Nenhuma linha reconhecida" />
          ) : (
            <>
              <div className={styles.resumo}>
                <span>
                  {linhas.length} linha(s) · {totalImportar} marcada(s) para importar
                </span>
                <button
                  className={styles.linkBotao}
                  onClick={() => {
                    void (async () => {
                      if (!(await pedirConfirmacao("Descartar as linhas analisadas e recomeçar?")))
                        return;
                      setLinhas(null);
                    })();
                  }}
                >
                  Novo extrato
                </button>
              </div>

              <div className={styles.acoesLote}>
                <button className={styles.botao} onClick={aceitarAutoClassificadas}>
                  ✓ Aceitar auto-classificadas
                </button>
                <button className={styles.botao} onClick={() => marcarTodas("import")}>
                  Marcar tudo p/ importar
                </button>
                <button className={styles.botao} onClick={() => marcarTodas("skip")}>
                  Marcar tudo p/ pular
                </button>
              </div>

              <div className={styles.filtros} role="tablist">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filtro === f.id}
                    className={`${styles.filtroBotao} ${filtro === f.id ? styles.filtroAtivo : ""}`}
                    onClick={() => setFiltro(f.id)}
                  >
                    {f.rotulo}
                    {f.id !== "todas" && ` (${linhas.filter((l) => l.decisao === f.id).length})`}
                  </button>
                ))}
              </div>

              <div className={styles.lista}>
                {visiveis.map((l) => (
                  <div key={l.id} className={styles.linha}>
                    <label className={styles.linhaAcao}>
                      <input
                        type="checkbox"
                        checked={l.acao === "import"}
                        onChange={(e) =>
                          atualizarLinha(l.id, { acao: e.target.checked ? "import" : "skip" })
                        }
                      />
                    </label>
                    <div className={styles.linhaCorpo}>
                      <div className={styles.linhaTopo}>
                        <span className={styles.linhaDesc}>{l.descricao}</span>
                        <span
                          className={l.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}
                        >
                          {formatMoney(l.valor, cfg.currency)}
                        </span>
                      </div>
                      <div className={styles.linhaMeta}>
                        <span>
                          {l.data.slice(8, 10)}/{l.data.slice(5, 7)}
                        </span>
                        <span
                          className={`${styles.badge} ${corConfianca(l.classificacao.confianca)}`}
                        >
                          {ROTULO_DECISAO[l.decisao]}
                        </span>
                        <Seletor
                          variante="inline"
                          rotulo={`Categoria de ${l.descricao}`}
                          nivel={0}
                          valor={l.categoriaEscolhida}
                          opcoes={opcoesCategoria}
                          aoMudar={(c) => atualizarLinha(l.id, { categoriaEscolhida: c })}
                          desativado={l.classificacao.tipo === "receita"}
                        />
                      </div>
                      {l.duplicata.status !== "new" && l.duplicata.correspondencia && (
                        <p className={styles.motivoDup}>
                          Parece com "{l.duplicata.correspondencia.descricao}" —{" "}
                          {l.duplicata.motivos.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className={styles.confirmar}
                onClick={confirmar}
                disabled={enviando || totalImportar === 0}
              >
                {enviando ? "Aguarde…" : `Confirmar importação (${totalImportar})`}
              </button>
            </>
          ))}
      </AbaTransicao>
    </Pagina>
  );
}
