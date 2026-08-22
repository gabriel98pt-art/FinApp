import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import Pagina, { EstadoVazio } from "../components/Pagina";
import Seletor from "../components/Seletor";
import BottomSheet from "../components/BottomSheet";
import {
  apagarExistentes,
  construirExistentes,
  confirmarImportacao,
  dadosDaCarga,
  dadosDaTransferencia,
  pagamentoDaLinha,
} from "../services/importacaoService";
import { useAbasTeclado } from "../hooks/useAbasTeclado";
import { useConfirmar } from "../hooks/useConfirmar";
import { useAuthStore } from "../stores/authStore";
import { useCfgStore } from "../stores/cfgStore";
import {
  useDespesasFixasStore,
  useDespesasStore,
  useReceitasStore,
  useTransferenciasStore,
} from "../stores/lancamentosStore";
import { useImportacaoStore } from "../stores/importacaoStore";
import { useParcelasStore } from "../stores/parcelasStore";
import { useVeiculoStore } from "../stores/veiculoStore";
import { mostrarToast } from "../stores/toastStore";
import { analisarLinha, aplicarContaATodas, estimarKwh } from "../utils/importacao";
import { parseExtratoCsv } from "../utils/importacaoParser";
import { extrairExtratoPdf, LeitorPdfIndisponivel } from "../utils/extrairExtratoPdf";
import { formatMoney } from "../utils/money";
import { rotuloMes, somarMeses } from "../utils/calculos";
import { montarDadosFatura } from "../utils/fatura";
import type {
  Confianca,
  Currency,
  DecisaoLinha,
  DestinoLinha,
  ExistenteParaDedup,
  LinhaAnalisada,
  LinhaExtrato,
  OrigemExistente,
} from "../types";
import { idAba, idPainelAba } from "../utils/abas";
import styles from "./Importar.module.css";

const ROTULO_DECISAO: Record<DecisaoLinha, string> = {
  auto_classificada: "Auto-classificada",
  nova: "Nova",
  duplicata_provavel: "Provável duplicata",
  revisao: "Revisão",
};

/** Onde um registo já existente mora, em português — usado no "ver detalhes"
 *  de um possível cruzamento (duplicata ou outra ponta de transferência). */
const ROTULO_ORIGEM: Record<OrigemExistente, string> = {
  receita: "Receitas",
  despesa: "Despesas",
  carga: "Veículo — carga elétrica",
  despesaVeiculo: "Veículo — despesa",
  transferencia: "Transferências",
  despesaFixa: "Despesas fixas",
};

/** Tipo do registo de cada linha na revisão. "Lançamento simples" é o que
 *  sempre houve (receita ou despesa); os outros dois gravam noutros domínios.
 *
 *  A recarga só existe do lado das saídas — não se recarrega o carro a receber
 *  dinheiro. A transferência interna existe dos dois lados: a mesma passagem de
 *  dinheiro aparece a sair no extrato de uma conta e a entrar no da outra. */
const DESTINOS_SAIDA: DestinoLinha[] = [
  "lancamento",
  "carga",
  "transferencia_cartao",
  "pagamento_fatura",
];
const DESTINOS_ENTRADA: DestinoLinha[] = ["lancamento", "transferencia_cartao"];

/** A transferência tem o mesmo nome dos dois lados: a direção já se lê no sinal
 *  e na cor do valor, ao lado, e não precisa de ser repetida aqui. */
function rotuloDestino(destino: DestinoLinha): string {
  if (destino === "lancamento") return "Lançamento simples";
  if (destino === "carga") return "Recarga elétrica";
  if (destino === "pagamento_fatura") return "Fatura paga";
  return "Transferência interna";
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

/** Meses possíveis para a fatura paga nesta linha: o mês da linha, dois antes
 *  e um depois. Cobre o pagamento adiantado e o atrasado sem obrigar a
 *  escrever uma data. */
function mesesDaFatura(data: string): string[] {
  const base = data.slice(0, 7);
  return [-2, -1, 0, 1].map((n) => somarMeses(base, n));
}

/** Descrição legível de um lançamento já existente, pro aviso de duplicata.
 *  A carga elétrica não guarda um texto de descrição — só o local do posto
 *  (ver `construirExistentes`) —, e mostrar isso sozinho ("Ionity A1") não diz
 *  a quem lê que é uma carga nem quanto custou. Os outros domínios já guardam
 *  descrição legível, por isso ficam como estão. */
function descricaoExistente(ex: ExistenteParaDedup, currency: Currency): string {
  if (ex.origem === "carga") {
    return `Carga elétrica em ${ex.descricao} no valor de ${formatMoney(Math.abs(ex.valor), currency)}`;
  }
  return ex.descricao;
}

function corConfianca(c: Confianca): string {
  return c === "high" ? styles.confAlta : c === "medium" ? styles.confMedia : styles.confBaixa;
}

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

  // O rascunho (texto colado + linhas analisadas) vive numa store persistida:
  // trocar de página e voltar, ou até dar refresh, mantém o extrato que ainda
  // não foi confirmado — antes desaparecia ao desmontar a página.
  const texto = useImportacaoStore((s) => s.texto);
  const setTexto = useImportacaoStore((s) => s.setTexto);
  const linhas = useImportacaoStore((s) => s.linhas);
  const setLinhas = useImportacaoStore((s) => s.setLinhas);
  const resetarRascunho = useImportacaoStore((s) => s.resetar);

  const [filtro, setFiltro] = useState<DecisaoLinha | "todas">("todas");
  const { propsLista, propsAba } = useAbasTeclado({
    abas: FILTROS.map((f) => f.id),
    atual: filtro,
    aoMudar: setFiltro,
  });
  const [enviando, setEnviando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  /** Conta escolhida para o extrato todo de uma vez. O extrato costuma ser de
   *  uma conta só, e escolher a mesma linha a linha era o trabalho repetido
   *  desta página. Só guarda o que foi escolhido em massa — a fonte da verdade
   *  continua a ser o campo de cada linha, que fica livre para ser mudado
   *  depois individualmente. */
  const [contaEmMassa, setContaEmMassa] = useState<string>("");
  /** Linhas que vão entrar e que se parecem com algo já registado — quando há,
   *  passam pela folha de revisão antes de qualquer gravação. */
  const [revisaoDup, setRevisaoDup] = useState<LinhaAnalisada[] | null>(null);
  /** Ids das linhas cujo registo antigo o usuário mandou apagar. Desligado por
   *  omissão: apagar é sempre escolha dele, nunca automático. */
  const [marcadasParaApagar, setMarcadasParaApagar] = useState<Set<number>>(new Set());
  /** Linhas cujo aviso "outra ponta da transferência" está expandido, mostrando
   *  data/valor/onde está do registo que bateu — fechado por omissão, pra não
   *  poluir a lista quando não interessa. */
  const [outraPontaAberta, setOutraPontaAberta] = useState<Set<number>>(new Set());
  const arquivoRef = useRef<HTMLInputElement>(null);

  const categoriasConfiguradas = cfg.categoriasDespesa;
  const opcoesCategoria = [
    ...new Set([...categoriasConfiguradas, "Cartão de Crédito", "Transferência", "Outros"]),
  ];
  // Receita não tem categoria, tem FONTE — outro conceito e outro campo. A
  // lista de despesas ("Alimentação", "Saúde") não dizia nada a quem estava a
  // classificar um salário.
  const opcoesFonte = [...new Set([...cfg.fontesReceita, "Transferência", "Outros"])];
  // Só cartões de crédito têm fatura para pagar.
  const cartoesCredito = cfg.contasCartoes.filter((c) => cfg.tipoCartao[c] === "credit");

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
        transferenciasHistorico: transferencias,
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

  function marcarContaParaTodas(conta: string) {
    setContaEmMassa(conta);
    setLinhas((atual) => (atual ? aplicarContaATodas(atual, conta) : null));
  }

  /** Grava tudo o que está marcado para importar — sempre tudo, sem exceção —
   *  e só depois apaga os registos antigos que o usuário tenha mandado apagar
   *  na revisão. Por esta ordem: se apagar falhar, ficou um repetido, que se
   *  resolve à mão; ao contrário, teria desaparecido dinheiro. */
  async function gravar(aImportar: LinhaAnalisada[], apagar: ExistenteParaDedup[]) {
    if (!uid) return;
    setEnviando(true);
    try {
      const n = await confirmarImportacao(uid, aImportar, {
        // O serviço não vai buscar dados a lado nenhum: o que ele precisa para
        // registar um pagamento de fatura sai daqui, onde já está carregado.
        faturasPagas: cfg.faturasPagas,
        diaFechamentoFatura: cfg.diaFechamentoFatura,
        parcelas,
        dados: montarDadosFatura({
          despesas,
          despesasFixas,
          transferencias,
          parcelas,
          veiculo,
          receitas,
        }),
      });
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
          (l.destino === "transferencia_cartao" && dadosDaTransferencia(l) === null) ||
          (l.destino === "pagamento_fatura" && pagamentoDaLinha(l) === null)),
    ) ?? [];

  return (
    <Pagina titulo="Importar">
      {/* Escape hatch sempre visível: o rascunho fica guardado entre trocas de
          aba e até um refresh (ver `importacaoStore`), então precisa de uma
          saída igualmente sempre à mão — sem isto, um extrato que ficasse num
          estado estranho prendia a tela para sempre. Some sozinho quando não
          há nada por limpar. */}
      {(texto.trim() || linhas !== null) && (
        <div className={styles.resetLinha}>
          <button
            className={styles.linkBotao}
            onClick={() => {
              void (async () => {
                if (!(await pedirConfirmacao("Limpar o rascunho da importação e recomeçar?")))
                  return;
                resetarRascunho();
                setFiltro("todas");
              })();
            }}
          >
            Resetar importação
          </button>
        </div>
      )}

      {linhas === null ? (
        <div
          className={`${styles.entrada} ${arrastando ? styles.entradaArrastando : ""}`}
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
            PDF do extrato, direto do banco. Ou CSV/texto delimitado (tab/;/,) com colunas de data,
            descrição e valor — exportado do banco ou colado direto de uma folha de cálculo. O
            ficheiro também pode ser arrastado para aqui, ou colado com ⌘V.
          </p>
          <textarea
            className={styles.textarea}
            placeholder={"Data;Descrição;Valor\n10/07/2026;Mercado Continente;-45,90"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            aria-labelledby="importar-entrada-titulo"
            aria-describedby="importar-entrada-sub"
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
            <Seletor
              variante="inline"
              rotulo="Conta de todas as linhas"
              nivel={0}
              valor={contaEmMassa}
              opcoes={cfg.contasCartoes}
              rotuloVazio="Conta de todas…"
              aviso="Nenhuma conta guardada — as contas vêm de Definições."
              aoMudar={marcarContaParaTodas}
            />
          </div>

          <div className={styles.filtros} role="tablist" {...propsLista}>
            {FILTROS.map((f) => (
              <button
                key={f.id}
                role="tab"
                id={idAba(f.id)}
                aria-selected={filtro === f.id}
                // Variante de painel único: ao contrário de Despesas ou
                // Veículo, aqui não há um painel por separador — é sempre a
                // mesma lista, filtrada. Os três separadores apontam para ela,
                // e é ela que muda de rótulo conforme o que está seleccionado.
                aria-controls={idPainelAba("linhas")}
                {...propsAba(f.id)}
                className={`${styles.filtroBotao} ${filtro === f.id ? styles.filtroAtivo : ""}`}
                onClick={() => setFiltro(f.id)}
              >
                {f.rotulo}
                {f.id !== "todas" && ` (${linhas.filter((l) => l.decisao === f.id).length})`}
              </button>
            ))}
          </div>

          <div
            className={styles.lista}
            role="tabpanel"
            id={idPainelAba("linhas")}
            aria-labelledby={idAba(filtro)}
          >
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
                    {/* O extrato traz nomes cifrados ("COMPRA 1234 PT"): dá para
                        corrigir aqui, antes de gravar. Os rótulos dos seletores
                        da linha acompanham sozinhos, são interpolação. */}
                    <input
                      className={styles.linhaDesc}
                      aria-label={`Nome de ${l.descricao}`}
                      value={l.descricao}
                      onChange={(e) => atualizarLinha(l.id, { descricao: e.target.value })}
                    />
                    <span className={l.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}>
                      {formatMoney(l.valor, cfg.currency)}
                    </span>
                  </div>
                  {/* Nota livre, em qualquer destino que tenha campo para ela. */}
                  <input
                    className={styles.linhaNota}
                    aria-label={`Nota de ${l.descricao}`}
                    placeholder="Nota (opcional)"
                    value={l.notaEscolhida}
                    onChange={(e) => atualizarLinha(l.id, { notaEscolhida: e.target.value })}
                  />
                  <div className={styles.linhaMeta}>
                    <span>
                      {l.data.slice(8, 10)}/{l.data.slice(5, 7)}
                    </span>
                    <span className={`${styles.badge} ${corConfianca(l.classificacao.confianca)}`}>
                      {ROTULO_DECISAO[l.decisao]}
                    </span>
                    <Seletor
                      variante="inline"
                      rotulo={`Tipo do registro de ${l.descricao}`}
                      nivel={0}
                      valor={l.destino}
                      opcoes={l.valor < 0 ? DESTINOS_SAIDA : DESTINOS_ENTRADA}
                      rotuloOpcao={(d) => rotuloDestino(d as DestinoLinha)}
                      aoMudar={(d) => atualizarLinha(l.id, { destino: d as DestinoLinha })}
                    />
                    {l.destino === "pagamento_fatura" ? (
                      <>
                        {/* Qual fatura foi paga: cartão e mês. O mês começa
                                no da própria linha e corrige-se aqui — quem
                                paga a 2 de agosto a fatura de julho. */}
                        <Seletor
                          variante="inline"
                          rotulo={`Cartão de ${l.descricao}`}
                          nivel={0}
                          valor={l.fatCartaoEscolhido}
                          opcoes={cartoesCredito}
                          rotuloVazio="Qual cartão…"
                          aviso="Nenhum cartão de crédito guardado — os cartões vêm de Definições."
                          aoMudar={(v) => atualizarLinha(l.id, { fatCartaoEscolhido: v })}
                        />
                        <Seletor
                          variante="inline"
                          rotulo={`Mês da fatura de ${l.descricao}`}
                          nivel={0}
                          valor={l.fatMesEscolhido}
                          opcoes={mesesDaFatura(l.data)}
                          rotuloOpcao={rotuloMes}
                          aoMudar={(v) => atualizarLinha(l.id, { fatMesEscolhido: v })}
                        />
                        <Seletor
                          variante="inline"
                          rotulo={`Conta que pagou ${l.descricao}`}
                          nivel={0}
                          valor={l.contaOrigem}
                          opcoes={cfg.contasCartoes}
                          rotuloVazio="Pago de…"
                          aviso="Nenhuma conta guardada — as contas vêm de Definições."
                          aoMudar={(v) => atualizarLinha(l.id, { contaOrigem: v })}
                        />
                      </>
                    ) : l.destino === "transferencia_cartao" ? (
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
                        {/* De que conta ou cartão saiu/entrou este
                                dinheiro. Sendo cartão de crédito, é isto que
                                faz o lançamento contar pra fatura dele — sem
                                escolher nada aqui, fica de fora de qualquer
                                fatura, como sempre foi. */}
                        <Seletor
                          variante="inline"
                          rotulo={`Conta ou cartão de ${l.descricao}`}
                          nivel={0}
                          valor={l.contaEscolhida}
                          opcoes={cfg.contasCartoes}
                          rotuloVazio="Nenhuma conta…"
                          aviso="Nenhuma conta guardada — as contas vêm de Definições."
                          aoMudar={(v) => atualizarLinha(l.id, { contaEscolhida: v })}
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
                    l.destino === "pagamento_fatura" &&
                    pagamentoDaLinha(l) === null && (
                      <p className={styles.faltaCarga}>
                        {!l.fatCartaoEscolhido.trim()
                          ? "Escolha de que cartão é esta fatura."
                          : "Escolha a conta que pagou."}
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
                  {/* A outra ponta da mesma transferência, já lançada do
                          lado contrário. Fica em tom próprio: não é "isto já
                          foi importado", é "este dinheiro já está no app pelo
                          outro lado". Mesmo formato do aviso de duplicata
                          logo abaixo (descrição + motivos), pra não faltar
                          justamente a pista mais concreta — a proximidade de
                          data —, e com "ver detalhes" pra conferir sem sair
                          da lista. */}
                  {l.outraPonta?.correspondencia && (
                    <div className={styles.outraPonta}>
                      <p>
                        O outro lado desta transferência já pode estar registado como "
                        {descricaoExistente(l.outraPonta.correspondencia, cfg.currency)}" —{" "}
                        {l.outraPonta.motivos.join(", ")}. Se for a mesma, desmarque esta linha para
                        não contar o dinheiro duas vezes.
                      </p>
                      <button
                        type="button"
                        className={styles.outraPontaAcao}
                        onClick={() =>
                          setOutraPontaAberta((atual) => {
                            const novo = new Set(atual);
                            if (novo.has(l.id)) novo.delete(l.id);
                            else novo.add(l.id);
                            return novo;
                          })
                        }
                      >
                        {outraPontaAberta.has(l.id) ? "Ocultar detalhes" : "Ver detalhes"}
                      </button>
                      {outraPontaAberta.has(l.id) && (
                        <dl className={styles.outraPontaDetalhes}>
                          <dt>Data</dt>
                          <dd>
                            {l.outraPonta.correspondencia.data.slice(8, 10)}/
                            {l.outraPonta.correspondencia.data.slice(5, 7)}/
                            {l.outraPonta.correspondencia.data.slice(0, 4)}
                          </dd>
                          <dt>Valor</dt>
                          <dd>
                            {formatMoney(
                              Math.abs(l.outraPonta.correspondencia.valor),
                              cfg.currency,
                            )}
                          </dd>
                          <dt>Onde está</dt>
                          <dd>{ROTULO_ORIGEM[l.outraPonta.correspondencia.origem]}</dd>
                        </dl>
                      )}
                    </div>
                  )}
                  {l.duplicata.status !== "new" && l.duplicata.correspondencia && (
                    <p className={styles.motivoDup}>
                      Parece com "{descricaoExistente(l.duplicata.correspondencia, cfg.currency)}" —{" "}
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
      )}

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
                  <span className={styles.revisaoDesc}>
                    {ex.origem === "carga" ? `Carga elétrica em ${ex.descricao}` : ex.descricao}
                  </span>
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
