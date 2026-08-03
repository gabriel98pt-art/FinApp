import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import Pagina, { EstadoVazio } from "../components/Pagina";
import AbaTransicao from "../components/AbaTransicao";
import ImportarBackupAntigo from "../components/ImportarBackupAntigo";
import Seletor from "../components/Seletor";
import BottomSheet from "../components/BottomSheet";
import {
  apagarExistentes,
  construirExistentes,
  confirmarImportacao,
  dadosDaCarga,
  dadosDaTransferencia,
} from "../services/importacaoService";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { analisarLinha, estimarKwh } from "../utils/importacao";
import { parseExtratoCsv } from "../utils/importacaoParser";
import { extrairExtratoPdf, LeitorPdfIndisponivel } from "../utils/extrairExtratoPdf";
import { formatMoney } from "../utils/money";
import type {
  Confianca,
  DecisaoLinha,
  DestinoLinha,
  ExistenteParaDedup,
  LinhaAnalisada,
  LinhaExtrato,
} from "../types";
import styles from "./Importar.module.css";

const ROTULO_DECISAO: Record<DecisaoLinha, string> = {
  auto_classificada: "Auto-classificada",
  nova: "Nova",
  duplicata_provavel: "Provável duplicata",
  revisao: "Revisão",
};

/** Destino de cada linha na revisão. "Lançamento normal" é o que sempre houve
 *  (receita ou despesa); os outros dois gravam noutros domínios.
 *
 *  A recarga só existe do lado das saídas — não se recarrega o carro a receber
 *  dinheiro. A transferência entre contas próprias existe dos dois lados: a
 *  mesma passagem de dinheiro aparece a sair no extrato de uma conta e a
 *  entrar no da outra. */
const DESTINOS_SAIDA: DestinoLinha[] = ["lancamento", "carga", "transferencia_cartao"];
const DESTINOS_ENTRADA: DestinoLinha[] = ["lancamento", "transferencia_cartao"];

/** O rótulo da transferência depende do lado: a mesma opção é "veio" no
 *  extrato de quem recebe e "foi" no de quem manda. */
function rotuloDestino(destino: DestinoLinha, ehSaida: boolean): string {
  if (destino === "lancamento") return "Lançamento normal";
  if (destino === "carga") return "Recarga elétrica";
  return ehSaida ? "Foi para outra conta minha" : "Veio de outra conta minha";
}

/** Receita ou despesa, à mão. O automático acerta quase sempre, mas quando
 *  erra o lado — um estorno do supermercado que bate numa regra de despesa —
 *  a revisão é a última oportunidade de corrigir: depois de gravado, o tipo
 *  não se muda (são coleções separadas). */
const TIPOS: LinhaAnalisada["tipoEscolhido"][] = ["despesa", "receita"];
const ROTULO_TIPO: Record<LinhaAnalisada["tipoEscolhido"], string> = {
  despesa: "Despesa",
  receita: "Receita",
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
  // Carga elétrica, despesa do veículo e transferência também são dinheiro que
  // pode vir repetido no extrato — entram na comparação de duplicatas.
  const veiculo = useVeiculoStore((s) => s.dados);
  const transferencias = useTransferenciasStore((s) => s.itens);
  const despesasFixas = useDespesasFixasStore((s) => s.itens);

  const [aba, setAba] = useState<Aba>("extrato");
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaAnalisada[] | null>(null);
  const [filtro, setFiltro] = useState<DecisaoLinha | "todas">("todas");
  const [enviando, setEnviando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  /** Linhas que vão entrar e que se parecem com algo já registado — quando há,
   *  passam pela folha de revisão antes de qualquer gravação. */
  const [revisaoDup, setRevisaoDup] = useState<LinhaAnalisada[] | null>(null);
  /** Ids das linhas cujo registo antigo o usuário mandou apagar. Desligado por
   *  omissão: apagar é sempre escolha dele, nunca automático. */
  const [marcadasParaApagar, setMarcadasParaApagar] = useState<Set<number>>(new Set());
  const arquivoRef = useRef<HTMLInputElement>(null);

  const categoriasConfiguradas = [...cfg.categoriasFixas, ...cfg.categoriasCorrentes];
  const opcoesCategoria = [
    ...new Set([...categoriasConfiguradas, "Cartão de Crédito", "Transferência", "Outros"]),
  ];
  // Receita não tem categoria, tem FONTE — outro conceito e outro campo. A
  // lista de despesas ("Alimentação", "Saúde") não dizia nada a quem estava a
  // classificar um salário.
  const opcoesFonte = [...new Set([...cfg.fontesReceita, "Transferência", "Outros"])];

  function analisar(brutas: LinhaExtrato[]) {
    if (brutas.length === 0) {
      mostrarToast("Nenhuma linha reconhecida — confira o formato do extrato.");
      return;
    }
    const existentes = construirExistentes(
      receitas,
      despesas,
      veiculo.cargas,
      veiculo.despesas,
      transferencias,
      despesasFixas,
    );
    const analisadas = brutas.map((tx, i) =>
      analisarLinha(tx, i, {
        parcelas,
        categoriasConfiguradas,
        // A memória do app é o próprio histórico do usuário: o que ele já
        // categorizou antes vale mais do que qualquer regra genérica.
        despesasHistorico: despesas,
        receitasHistorico: receitas,
        existentes,
        locaisCarregamento: cfg.locaisCarregamento,
        cargasHistorico: veiculo.cargas,
      }),
    );
    setLinhas(analisadas);
    setFiltro("todas");
    mostrarToast(`${analisadas.length} linha(s) analisada(s)`);
  }

  /** O ficheiro pode chegar de três sítios — o botão de sempre, arrastado para
   *  a caixa, ou colado — e daqui para a frente o caminho é o mesmo. */
  function processarArquivo(arquivo: File) {
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

  function aoCarregarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Limpar antes de processar: sem isto, escolher o mesmo ficheiro outra vez
    // não dispara `change` nenhum.
    e.target.value = "";
    if (arquivo) processarArquivo(arquivo);
  }

  /** Só se acende para ficheiros: arrastar texto ou uma seleção dentro da
   *  página não é o gesto que nos interessa. */
  function temFicheiro(dt: DataTransfer | null) {
    return !!dt && Array.from(dt.types).includes("Files");
  }

  function aoArrastarPorCima(e: React.DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    // Sem este preventDefault o navegador abre o ficheiro na aba ao soltar,
    // deitando o app fora.
    e.preventDefault();
    setArrastando(true);
  }

  function aoSairDoArrasto(e: React.DragEvent) {
    // `dragleave` dispara também ao passar de um filho para o outro dentro da
    // caixa: só conta quando o ponteiro sai mesmo dela.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setArrastando(false);
  }

  function aoSoltar(e: React.DragEvent) {
    if (!temFicheiro(e.dataTransfer)) return;
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) processarArquivo(arquivo);
  }

  function aoColar(e: React.ClipboardEvent) {
    const arquivo = e.clipboardData?.files?.[0];
    // Sem ficheiro é texto a ser colado: sair do caminho e deixar o textarea
    // fazer o que sempre fez (colar um CSV de uma folha de cálculo).
    if (!arquivo) return;
    e.preventDefault();
    processarArquivo(arquivo);
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

  /** Grava tudo o que está marcado para importar — sempre tudo, sem exceção —
   *  e só depois apaga os registos antigos que o usuário tenha mandado apagar
   *  na revisão. Por esta ordem: se apagar falhar, ficou um repetido, que se
   *  resolve à mão; ao contrário, teria desaparecido dinheiro. */
  async function gravar(aImportar: LinhaAnalisada[], apagar: ExistenteParaDedup[]) {
    if (!uid) return;
    setEnviando(true);
    try {
      const n = await confirmarImportacao(uid, aImportar);
      if (apagar.length) await apagarExistentes(uid, apagar, despesasFixas);
      mostrarToast(`✓ ${n} lançamento(s) importado(s)`);
      setLinhas(null);
      setTexto("");
      setRevisaoDup(null);
    } catch {
      mostrarToast("Não foi possível importar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    if (!uid || !linhas) return;
    const aImportar = linhas.filter((l) => l.acao === "import");
    if (aImportar.length === 0) {
      mostrarToast("Nenhuma linha marcada para importar.");
      return;
    }
    if (incompletas.length > 0) {
      mostrarToast(`${incompletas.length} linha(s) por completar.`);
      return;
    }
    // Alguma das que vão entrar já se parece com algo que existe? Nesse caso
    // mostra-se o que bateu antes de gravar. A maioria das importações não
    // passa por aqui e segue direta, como sempre seguiu.
    const suspeitas = aImportar.filter(
      (l) =>
        (l.decisao === "duplicata_provavel" || l.decisao === "revisao") &&
        l.duplicata.correspondencia,
    );
    if (suspeitas.length > 0) {
      setMarcadasParaApagar(new Set());
      setRevisaoDup(suspeitas);
      return;
    }
    await gravar(aImportar, []);
  }

  const visiveis = linhas?.filter((l) => filtro === "todas" || l.decisao === filtro) ?? [];
  const totalImportar = linhas?.filter((l) => l.acao === "import").length ?? 0;
  // Recarga marcada para importar a que ainda falta o que só o usuário sabe:
  // trava a confirmação e fica assinalada na própria linha.
  const incompletas =
    linhas?.filter(
      (l) =>
        l.acao === "import" &&
        ((l.destino === "carga" && dadosDaCarga(l) === null) ||
          (l.destino === "transferencia_cartao" && dadosDaTransferencia(l) === null)),
    ) ?? [];

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
            <div
              className={`${styles.entrada} ${arrastando ? styles.entradaArrastando : ""}`}
              onDragOver={aoArrastarPorCima}
              onDragLeave={aoSairDoArrasto}
              onDrop={aoSoltar}
              onPaste={aoColar}
            >
              <p className={styles.entradaTitulo}>Colar ou carregar extrato</p>
              <p className={styles.entradaSub}>
                PDF do extrato, direto do banco. Ou CSV/texto delimitado (tab/;/,) com colunas de
                data, descrição e valor — exportado do banco ou colado direto de uma folha de
                cálculo. O ficheiro também pode ser arrastado para aqui, ou colado com ⌘V.
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
                          rotulo={`Destino de ${l.descricao}`}
                          nivel={0}
                          valor={l.destino}
                          opcoes={l.valor < 0 ? DESTINOS_SAIDA : DESTINOS_ENTRADA}
                          rotuloOpcao={(d) => rotuloDestino(d as DestinoLinha, l.valor < 0)}
                          aoMudar={(d) => atualizarLinha(l.id, { destino: d as DestinoLinha })}
                        />
                        {l.destino === "transferencia_cartao" ? (
                          <>
                            {/* De onde saiu: qualquer conta ou cartão do
                                usuário. Sendo cartão de crédito, o valor vai
                                parar à fatura dele; sendo conta comum, não vai
                                a fatura nenhuma — e é isso mesmo. */}
                            <Seletor
                              variante="inline"
                              rotulo={`Conta de origem de ${l.descricao}`}
                              nivel={0}
                              valor={l.contaOrigem}
                              opcoes={cfg.contasCartoes}
                              rotuloVazio="De onde veio…"
                              aviso="Nenhuma conta guardada — as contas vêm de Definições."
                              aoMudar={(v) => atualizarLinha(l.id, { contaOrigem: v })}
                            />
                            {/* E para onde foi: o extrato não diz de que conta
                                é, e sem isto o saldo dela ficava sem este
                                dinheiro. */}
                            <Seletor
                              variante="inline"
                              rotulo={`Conta que recebeu ${l.descricao}`}
                              nivel={0}
                              valor={l.contaDestino}
                              opcoes={cfg.contasCartoes}
                              rotuloVazio="Conta que recebeu…"
                              aviso="Nenhuma conta guardada — as contas vêm de Definições."
                              aoMudar={(v) => atualizarLinha(l.id, { contaDestino: v })}
                            />
                          </>
                        ) : l.destino === "carga" ? (
                          <>
                            <Seletor
                              variante="inline"
                              rotulo={`Local de ${l.descricao}`}
                              nivel={0}
                              valor={l.localCarga}
                              opcoes={cfg.locaisCarregamento}
                              rotuloVazio="Escolher local…"
                              aviso="Nenhum local de carregamento guardado — os locais vêm da aba Veículo."
                              aoMudar={(v) =>
                                atualizarLinha(l.id, {
                                  localCarga: v,
                                  // Outro posto, outro preço por kWh: a
                                  // estimativa é refeita na hora, com o mesmo
                                  // histórico que a sugestão automática usa.
                                  kwhCarga: estimarKwh(Math.abs(l.valor), v, veiculo.cargas),
                                })
                              }
                            />
                            {/* O extrato não traz os kWh e o app não os pode
                                deduzir: é o único campo digitado aqui. A
                                unidade fica ao lado — o placeholder desaparece
                                assim que se escreve, e um número solto no meio
                                dos seletores não diz o que é. */}
                            <span className={styles.campoKwh}>
                              <input
                                className={styles.kwh}
                                type="text"
                                inputMode="decimal"
                                placeholder="0,0"
                                aria-label={`kWh de ${l.descricao}`}
                                value={l.kwhCarga}
                                onChange={(e) => atualizarLinha(l.id, { kwhCarga: e.target.value })}
                              />
                              kWh
                            </span>
                          </>
                        ) : (
                          <>
                            <Seletor
                              variante="inline"
                              rotulo={`Receita ou despesa — ${l.descricao}`}
                              nivel={0}
                              valor={l.tipoEscolhido}
                              opcoes={TIPOS}
                              rotuloOpcao={(t) => ROTULO_TIPO[t as LinhaAnalisada["tipoEscolhido"]]}
                              aoMudar={(t) => {
                                const tipo = t as LinhaAnalisada["tipoEscolhido"];
                                // Trocar de lado troca a lista ao lado. Um
                                // valor da lista antiga não pode ficar para
                                // trás — "Extra" é fonte de receita, e ficaria
                                // gravado como se fosse categoria de despesa.
                                const lista = tipo === "receita" ? opcoesFonte : opcoesCategoria;
                                atualizarLinha(l.id, {
                                  tipoEscolhido: tipo,
                                  categoriaEscolhida: lista.includes(l.categoriaEscolhida)
                                    ? l.categoriaEscolhida
                                    : "Outros",
                                });
                              }}
                            />
                            <Seletor
                              variante="inline"
                              rotulo={
                                l.tipoEscolhido === "receita"
                                  ? `Fonte de ${l.descricao}`
                                  : `Categoria de ${l.descricao}`
                              }
                              nivel={0}
                              valor={l.categoriaEscolhida}
                              opcoes={l.tipoEscolhido === "receita" ? opcoesFonte : opcoesCategoria}
                              aoMudar={(c) => atualizarLinha(l.id, { categoriaEscolhida: c })}
                            />
                          </>
                        )}
                      </div>
                      {l.acao === "import" && l.destino === "carga" && !l.localCarga.trim() && (
                        <p className={styles.faltaCarga}>Escolha o local desta recarga.</p>
                      )}
                      {/* Sem kWh a linha entra na mesma — só fica por
                          completar. Aviso, não bloqueio. */}
                      {l.acao === "import" &&
                        l.destino === "carga" &&
                        l.localCarga.trim() &&
                        !l.kwhCarga.trim() && (
                          <p className={styles.notaCarga}>
                            Sem kWh — entra assim e completa-se depois no Veículo.
                          </p>
                        )}
                      {l.acao === "import" &&
                        l.destino === "transferencia_cartao" &&
                        dadosDaTransferencia(l) === null && (
                          <p className={styles.faltaCarga}>
                            {!l.contaOrigem.trim()
                              ? "Escolha a conta ou cartão de onde veio."
                              : !l.contaDestino.trim()
                                ? "Escolha a conta que recebeu."
                                : "A conta que recebeu tem de ser diferente da de origem."}
                          </p>
                        )}
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
                disabled={enviando || totalImportar === 0 || incompletas.length > 0}
              >
                {enviando ? "Aguarde…" : `Confirmar importação (${totalImportar})`}
              </button>
            </>
          ))}
      </AbaTransicao>

      {/* Revisão antes de gravar: o que vai entrar, ao lado do que já existe e
          se parece com isso. A importação acontece de qualquer maneira — o que
          se decide aqui é só se o registo ANTIGO também sai. Desligado por
          omissão: a pontuação de duplicata é palpite, e apagar por engano um
          lançamento verdadeiro é pior do que ficar com um repetido. */}
      <BottomSheet
        aberta={revisaoDup !== null}
        aoFechar={() => setRevisaoDup(null)}
        titulo="Isto já parece existir"
      >
        <div className={styles.revisaoLista}>
          {revisaoDup?.map((l) => {
            const ex = l.duplicata.correspondencia!;
            const marcada = marcadasParaApagar.has(l.id);
            return (
              <div key={l.id} className={styles.revisaoItem}>
                <div className={styles.revisaoLado}>
                  <span className={styles.revisaoRotulo}>A importar</span>
                  <span className={styles.revisaoDesc}>{l.descricao}</span>
                  <span className={styles.revisaoMeta}>
                    {l.data.slice(8, 10)}/{l.data.slice(5, 7)} ·{" "}
                    {formatMoney(l.valor, cfg.currency)}
                  </span>
                </div>
                <div className={styles.revisaoLado}>
                  <span className={styles.revisaoRotulo}>Já registado</span>
                  <span className={styles.revisaoDesc}>{ex.descricao}</span>
                  <span className={styles.revisaoMeta}>
                    {ex.data.slice(8, 10)}/{ex.data.slice(5, 7)} ·{" "}
                    {formatMoney(ex.valor, cfg.currency)}
                  </span>
                </div>
                <label className={styles.revisaoApagar}>
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={(e) =>
                      setMarcadasParaApagar((atual) => {
                        const novo = new Set(atual);
                        if (e.target.checked) novo.add(l.id);
                        else novo.delete(l.id);
                        return novo;
                      })
                    }
                  />
                  {ex.origem === "despesaFixa"
                    ? "também desmarcar esse mês como pago"
                    : "também apagar o registo existente"}
                </label>
              </div>
            );
          })}
        </div>
        <button
          className={styles.confirmar}
          disabled={enviando}
          onClick={() => {
            const aImportar = linhas?.filter((l) => l.acao === "import") ?? [];
            const apagar = (revisaoDup ?? [])
              .filter((l) => marcadasParaApagar.has(l.id))
              .map((l) => l.duplicata.correspondencia!);
            void gravar(aImportar, apagar);
          }}
        >
          {enviando ? "Aguarde…" : `Importar mesmo assim (${totalImportar})`}
        </button>
      </BottomSheet>
    </Pagina>
  );
}
